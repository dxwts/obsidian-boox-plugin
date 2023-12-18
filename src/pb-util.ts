import idb from "./idb";
import OssUtil from "./oss-util";
import _ from "lodash";
import protobuf from "protobufjs";
import JSZip from "jszip";
import BooxPlugin from "main";

export default class PBUtil {
	private static instance: PBUtil;

	oss: any;
	plugin: BooxPlugin;

	constructor(plugin: BooxPlugin) {
		this.plugin = plugin;
		this.oss = OssUtil.getInstance(plugin);
	}

	static getInstance(plugin: BooxPlugin) {
		if (!PBUtil.instance) {
			PBUtil.instance = new PBUtil(plugin);
		}
		return PBUtil.instance;
	}

	orderPbFileByTimestamp(keys: any) {
		let dataMap = keys.map((key: string) => {
			let str: any = key.split("#").pop();
			if (!str) {
				return;
			}
			str = str.split(".")[0];
			const obj = { time: +str, key: key };
			return obj;
		});

		dataMap = _.orderBy(dataMap, "time", "asc");
		dataMap = dataMap.map((item: any) => item.key);
		return dataMap;
	}

	async getNotePBFile(user: string, docId: string) {
		let res = false;
		const dir = `${user}/note/${docId}/shape`;
		let keys: any = await this.oss.listFile(dir);
		if (!keys) {
			return res;
		}

		keys = this.orderPbFileByTimestamp(keys);
		for (const key of keys) {
			const saved = await this.checkNotePBFile(key);
			if (!saved) {
				await this.savePBFile(key, user, docId);
				res = true;
			}
		}
		return res;
	}

	async savePBFile(pbFile: string, user: string, docId: string) {
		let data = await this.fetchPBFile(pbFile);
		data = await this.unzipPBFile(data);
		const pageId = this.getPageIdFromPBFile(pbFile);
		let shapes = await this.decodeNoteShapes(data);
		shapes = this.formatNoteShapes(shapes, docId, pageId);
		await this.savePBShapes(docId, shapes);
		await this.updateNotePBFileStatus(pbFile, docId);
	}

	async getNoteResourcePBFile(user: string, docId: string) {
		let res = false;
		const dir = `${user}/note/${docId}/resource/pb`;
		let keys = await this.oss.listFile(dir);
		if (!keys) {
			return;
		}
		keys = this.orderPbFileByTimestamp(keys);
		for (const key of keys) {
			const saved = await this.checkNotePBFile(key);
			if (!saved) {
				await this.saveResourcePBFile(key, user, docId);
				res = true;
			}
		}
		return res;
	}

	async checkNotePBFile(pbFile: string) {
		const db: any = idb.getPBFileDB();
		const res = await db.resource.get(pbFile);
		return !!res;
	}

	async saveResourcePBFile(pbFile: string, user: string, docId: string) {
		const data = await this.fetchPBFile(pbFile);
		const revId = this.getRevIdFromPBFile(pbFile);
		let shapes = await this.decodeNoteResourceShapes(data);
		shapes = this.formatNoteResourceShapes(shapes, docId, revId);
		await this.savePBShapes(docId, shapes);
		await this.updateNotePBFileStatus(pbFile, docId);
	}

	async fetchPBFile(pbFile: string) {
		let data = await this.oss.fetchFileData(pbFile);
		if (!data) {
			throw new Error("pb data not found");
		}
		data = data.content;
		return data;
	}

	async unzipPBFile(buf: any) {
		const data = await JSZip.loadAsync(buf);
		const keys = Object.keys(data.files);
		let content = null;
		if (keys.length > 0) {
			content = await data.files[keys[0]].async("uint8array");
		}
		return content;
	}

	getRevIdFromPBFile(pbFile: string) {
		const filename: any = pbFile.split("/").pop();
		const arr: string[] = filename.split("#");
		if (arr.length > 0) {
			return arr[1];
		}
		return null;
	}

	getNoteReourceProtoRoot() {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const jsonProto = require("src/proto/NoteShapeResourceProto.json");
		const root = protobuf.Root.fromJSON(jsonProto);
		return root;
	}

	async decodeNoteResourceShapes(buf: any) {
		const root = this.getNoteReourceProtoRoot();
		const resourceProtoList = root.lookupType("ResourceProtoList");
		const err = resourceProtoList.verify(buf);
		if (err) {
			throw err;
		}
		let shapes = resourceProtoList.decode(buf);
		shapes = shapes.toJSON().proto;
		return shapes;
	}

	formatNoteResourceShapes(shapes: any, docId: string, revId: string) {
		if (!shapes) {
			return null;
		}
		shapes = shapes.map((shape: any) => {
			shape.documentId = docId;
			shape.revisionId = revId;
			shape._id = shape.uniqueId;
			shape.createdAt = +shape.createdAt;
			shape.updatedAt = +shape.updatedAt;
			return shape;
		});
		return shapes;
	}

	async savePBShapes(docId: string, shapes: any) {
		if (!shapes) {
			return;
		}
		const shapeDbName = `${docId}_shape`;
		try {
		const db: any = idb.getShapeDB(shapeDbName);
		await db.shape.bulkPut(shapes);
		} catch (error) {
			console.error(error);
		}
	}

	async updateNotePBFileStatus(pbFile: string, docId: string) {
		const db: any = idb.getPBFileDB();
		const data = {
			id: pbFile,
			documentUniqueId: docId,
		};
		await db.resource.put(data);
	}

	getPageIdFromPBFile(pbFile: string) {
		const filename: any = pbFile.split("/").pop();
		const arr = filename.split("#");
		if (arr.length > 0) {
			return arr[0];
		}
		return null;
	}

	getNoteProtoRoot() {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const jsonProto = require("src/proto/NoteShapeInfoProto.json");
		const root = protobuf.Root.fromJSON(jsonProto);
		return root;
	}

	async decodeNoteShapes(buf: any) {
		const root = this.getNoteProtoRoot();
		const shapeInfoProtoList = root.lookupType("ShapeInfoProtoList");
		const err = shapeInfoProtoList.verify(buf);
		if (err) {
			throw err;
		}
		let shapes = shapeInfoProtoList.decode(buf);
		shapes = shapes.toJSON().proto;
		return shapes;
	}

	stringToJson(val: any) {
		if (val && typeof val === "string") {
			val = JSON.parse(val);
		}
		return val;
	}

	formatNoteShapes(shapes: any, docId: string, pageId: string) {
		if (!shapes) {
			return null;
		}
		let num = 0
		shapes = shapes.map((shape: any) => {
			shape.zorder = shape.zorder || 0;
			shape.boundingRect = this.stringToJson(shape.boundingRect);
			shape.createArgs = this.stringToJson(shape.createArgs);
			shape.lineStyle = this.stringToJson(shape.lineStyle);
			shape.matrixValues = this.stringToJson(shape.matrixValues);
			shape.textStyle = this.stringToJson(shape.textStyle);
			shape.resource = this.stringToJson(shape.resource);
			shape.extra = this.stringToJson(shape.extra);
			shape.shapeLineStyle = shape.lineStyle;
			shape.documentUniqueId = docId;
			shape.pageUniqueId = pageId;
			shape._id = shape.uniqueId;
			shape.shapeType = shape.shapeType ? shape.shapeType : 0;
			shape.createdAt = +shape.createdAt;
			shape.updatedAt = +shape.updatedAt;
			// 此字段用来判断渲染顺序, 兼容设备复制出来的shape创建时间都是一样的问题
			shape.timestamp = Date.now() + num++
			return shape;
		});
		return shapes;
	}
}
