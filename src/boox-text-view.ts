import { TFile, TextFileView, WorkspaceLeaf } from "obsidian";
import { promises as fsPromises } from "fs";
import * as path from "path";
import BooxPlugin from "../main";
import idb from "src/idb";
import OssUtil from "src/oss-util";
import SyncUtil from "src/sync-util";
import { Subject } from "rxjs";
import _ from "lodash";
import { shapeTypes, ICON_NOTE_SYNC } from "src/constants";

export const BOOX_TEXT_VIEW_TYPE = "boox-text-view";

export class BooxTextView extends TextFileView {
	file: any;
	note: any;
	subject: any;
	leaf: WorkspaceLeaf;
	plugin: BooxPlugin;
	tiptap: any;
	shapeDbName: string;
	shapeDataDbName: string;
	resource: any;
	shape: any;
	oss: OssUtil;
	assets: any[];
	pageId: string;

	loadingEl: HTMLElement | null;

	SyncUtil: any;

	constructor(leaf: WorkspaceLeaf, plugin: BooxPlugin) {
		super(leaf);
		this.leaf = leaf;
		this.plugin = plugin;
		this.oss = OssUtil.getInstance(this.plugin);
		this.SyncUtil = SyncUtil.getInstance(this.plugin);

		this.file = leaf.view.file;

		this.subject = new Subject();
		this.subject.subscribe((data: any) => {
			this.handleAction(data.action, data.data);
		});

		this.registerEvent(
			this.app.workspace.on("file-open", (file: TFile) => {
				if (!file || file.extension !== "toox") return;
				this.file = file;
				localStorage.setItem("lastOpenedFile", file.path);
			})
		);
	}

	getViewType(): string {
		return BOOX_TEXT_VIEW_TYPE;
	}

	getDisplayText(): string {
		return this.file?.basename || "";
	}

	getIcon(): string {
		return "boox";
	}

	onload(): void {
		console.log("loading boox plugin: ", this.plugin.manifest);
		super.onload();
		this.createMenuBtn();
	}

	onunload(): void {
		super.onunload();
		// this.containerEl.style.backgroundColor = "";
	}

	async setViewData(data: string, clear: boolean): void {
		this.note = JSON.parse(data);
		const res = await idb.getNoteTree(this.note.user, this.note.uniqueId);
		if (res) {
			this.note = res.data;
		}
		this.shapeDbName = `${this.note.uniqueId}_shape`;
		this.shapeDataDbName = `${this.note.uniqueId}_shape_data`;
		this.subject.next({ action: "loadData", data: this.note });
	}

	getViewData(): string {
		return JSON.stringify(this.note);
	}

	clear(): void {}

	async setIframe() {
		const iframe = document.createElement("iframe");
		
		const pluginDir = this.plugin.app.vault.adapter.basePath;

		if (!pluginDir) {
			return;
		}

		// const js = await fsPromises.readFile(
		// 	path.join(
		// 		pluginDir,
		// 		".obsidian",
		// 		"plugins",
		// 		"obsidian-boox-plugin",
		// 		"onyxEditor.js"
		// 	),
		// 	"utf8"
		// );

		// const css = await fsPromises.readFile(
		// 	path.join(
		// 		pluginDir,
		// 		".obsidian",
		// 		"plugins",
		// 		"obsidian-boox-plugin",
		// 		"onyxEditorFont.css"
		// 	),
		// 	"utf8"
		// );

		// const jsBlob = new Blob([js], { type: "application/javascript" });
		// const jsBlobUrl = URL.createObjectURL(jsBlob);

		// const cssBlob = new Blob([css], { type: "text/css" });
		// const cssBlobUrl = URL.createObjectURL(cssBlob);

		iframe.addEventListener("load", () => {
			console.log("iframe loaded");
			// @ts-ignore
			this.tiptap = iframe.contentWindow.TipTap;
			this.tiptap.setEditable(false);
		});
		iframe.srcdoc = `
		<!doctype html>
		<html lang="">
			<head>
				<meta charset="utf-8"/>
				<meta http-equiv="X-UA-Compatible" content="IE=edge"/>
				<meta name="viewport" content="width=device-width, initial-scale=1"/>
				<title>onyx-editor</title>
				<link rel="stylesheet" href="https://static-us-volc.boox.com/obsidian/assets/onyxEditorFont.css"/>
				<script defer="defer" src="https://static-us-volc.boox.com/obsidian/assets/onyxEditor.js"></script>
			</head>
			<body>
				<div id="app"></div>
			</body>
		</html>`;
		iframe.style.backgroundColor = "#f8f8f8";
		iframe.style.width = "100%";
		iframe.style.height = "100%";
		iframe.style.border = "none";
		this.contentEl.appendChild(iframe);
	}

	async handleAction(action: string, data: any) {
		switch (action) {
			case "loadData":
				this.loadData(data);
				break;
			default:
				break;
		}
	}

	async loadData(note: any) {
		try {
			this.hideLoading();
			this.contentEl.innerHTML = "";
			this.pageId = note.richTextPageNameList?.pageNameList[0] || null;
			if(!this.pageId) {
				return;
			}
			this.setIframe();

			this.showLoading();
			await this.syncNoteData(note);
			this.note.shapes = await this.loadShapes();
			await this.renderPage(this.pageId);
			this.tiptap.setOnyxImgEditable(false)

			setTimeout(() => {
				this.hideLoading();
			}, 500);
		} catch (error) {
			this.contentEl.innerHTML = "";
			this.hideLoading();
		}
	}

	async loadShapes() {
		try {
			const db:any = await idb.getShapeDB(this.shapeDbName);
			const shapes = await db.shape.toArray();
			return shapes || []
		} catch (error) {
			console.log(error);
		}
		return [];
	}

	async renderPage(pageId: string) {
		try {
			await this.getResourceFromCache(pageId);
			const resource = await this.getResource(this.note.shapes);
			this.shape = await this.getShape(this.note.shapes);
			let content = await this.getContent(this.shape);
			content = this.setResource(content, resource);
			this.tiptap.setJsonContent(content);
			this.tiptap.setEditable(false);
			this.setRecordingList(this.shape);
		} catch (error) {
			console.log(error);
		}
	}

	async getResource(shapes: any) {
		const data: any = {};
		const assets: any[] = [];
		const resShapes = shapes.filter((item: any) => {
			return (
				item.shapeType === shapeTypes.SHAPE_RICH_TEXT_RESOURCE ||
				item.shapeType === shapeTypes.SHAPE_IMAGE
			);
		});
		for (const shape of resShapes) {
			let res = this.resource.find((item: any) => {
				return item.id === shape.resource.uniqueId;
			});
			const key = `/note/${shape.resource.documentId}/resource/data${shape.resource.relativePath}`;
			if (!res) {
				const url = await this.oss.getResourceUrl(
					`${this.note.user}${key}`
				);
				res = await fetch(url);
				res = await res.blob();
				await this.saveResource(shape, res);
			} else {
				res = res.data;
			}
			const imgUrl = URL.createObjectURL(res);
			data[key] = imgUrl;

			const resItem = {
				localPath: shape.resource.localPath,
				url: data[shape.resource.localPath],
				ossUrl: key,
				uniqueId: shape.resource.uniqueId,
			};
			assets.push(resItem);
		}
		if (!this.assets) {
			this.assets = [];
		}
		this.assets = [...this.assets, ...assets];
		return data;
	}

	async getShape(shapes) {
		let contentShapes = shapes.filter((item) => {
			return item.shapeType === shapeTypes.SHAPE_RICH_TEXT;
		});

		contentShapes = _.orderBy(contentShapes, ["updatedAt"], ["desc"]);
		let shape = contentShapes[0];
		if (!shape) {
			shape = await this.createTextShape();
		}

		if (typeof shape.resource === "string") {
			try {
				shape.resource = JSON.parse(shape.resource);
			} catch (error) {
				console.error(error);
			}
		}

		return shape;
	}

	async createTextShape() {
		const docId = this.note.uniqueId;
		const pageId = this.pageId;
		const user = this.note.user;
		const shape = {
			documentUniqueId: docId,
			pageUniqueId: pageId,
			revisionId: "",
			shapeType: 29,
			thickness: 0,
			user: user,
			matrixValues: {
				empty: false,
				values: [1, 0, 0, 0, 1, 0, 0, 0, 1],
			},
		};

		return shape;
	}

	async getContent(shape) {
		if (!shape) {
			return "";
		}
		let res = this.resource.find((item) => {
			return item.id === shape.resource.uniqueId;
		});

		if (!res) {
			const key = `${this.note.user}/note/${shape.resource.documentId}/resource/data${shape.resource.relativePath}`;
			res = await this.oss.fetchFileData(key);
			await this.saveResource(shape, res.content);
			res = res.content;
		} else {
			res = Buffer.from(res.data);
		}
		// res = res.slice(4)
		res = res.toString();
		return res;
	}

	async getResourceFromCache(page: string) {
		const db = idb.getResourceDB(this.shapeDbName);
		this.resource = await db.resource
			.where("pageUniqueId")
			.equals(page)
			.toArray();
	}

	async syncNoteData(note: any) {
		await this.SyncUtil.syncShapes(note.user, note.uniqueId);
	}

	async saveResource(shape, data) {
		try {
			const db = idb.getResourceDB(this.shapeDbName);
			const res = {
				id: shape.resource.uniqueId,
				documentUniqueId: shape.documentUniqueId,
				pageUniqueId: shape.pageUniqueId,
				data: data,
			};
			await db.resource.put(res);
		} catch (error) {
			console.log(error);
		}
	}

	setResource(content, resource) {
		if (typeof content === "string") {
			try {
				content = JSON.parse(content);
			} catch (error) {
				console.error(error);
			}
		}

		const tmpContent = "doc" === content.type ? content : content.content;
		this.setResourceUrl(tmpContent, resource);
		return content;
	}

	setResourceUrl(content, resource) {
		for (let i = 0; i < content.content.length; i++) {
			const item = content.content[i];
			if (item.type === "onyxImg" || item.type === "attach") {
				item.attrs.src =
					resource[item.attrs.dataKey.replace(this.note.user, "")];
			}

			if (item.content) {
				this.setResourceUrl(item, resource);
			}
		}
	}

	async setRecordingList(shape: any) {
		let list: any[] = [];
		if (!shape.extra || !shape.extra.audioInfoList) {
			return;
		}
		try {
			list = shape.extra.audioInfoList || [];
		} catch (error) {
			console.error(error);
		}

		if (shape.extra && shape.extra.audioDataSetList) {
			for (const item of shape.extra.audioDataSetList) {
				list = [...list, ...item.audioInfoList];
			}
		}

		list = _.uniqBy(list, "audioPath");

		const arr: any[] = [];
		for (const item of list) {
			const obj: any = {};
			obj.title = item.audioPath.split("/").pop();
			const key = this.getRecordingResKey(item, shape.documentUniqueId);
			obj.url = await this.oss.getResourceUrl(key);
			obj.duration = item.duration;
			if (obj.url) {
				arr.push(obj);
			}
		}
	}

	getRecordingResKey(item, docId) {
		const index = item.audioPath.indexOf(docId);
		if (index === -1) {
			return null;
		}
		const filePath = item.audioPath.slice(index);
		return `${this.note.user}/note/${filePath}`;
	}

	async deleteNoteLocalDatabase() {
		await idb.deleteDB(this.shapeDbName)
		await idb.deleteDB(this.shapeDataDbName)
		await idb.deleteDB(`${this.shapeDbName}_resource`)
		await idb.deleteDB(`_tmp_${this.shapeDbName}`)
		await idb.deleteDB(`_tmp_${this.shapeDataDbName}`)

		const db:any = idb.getPBFileDB()
		const records = await db.resource.where('documentUniqueId').equals(this.note.uniqueId).toArray()
		const deletes = records.map((record: any) => db.resource.delete(record.id))
		await Promise.all(deletes)
	}

	showLoading() {
		this.loadingEl = document.createElement("div");
		this.loadingEl.style.position = "absolute";
		this.loadingEl.style.width = "100%";
		this.loadingEl.style.height = "100%";
		this.loadingEl.style.background = "rgba(0,0,0,0.3)";
		this.loadingEl.style.zIndex = "100";
		this.loadingEl.style.display = "flex";
		this.loadingEl.style.justifyContent = "center";
		this.loadingEl.style.alignItems = "center";
		this.loadingEl.innerHTML = `<div class="lds-dual-ring"></div>`;
		this.containerEl.appendChild(this.loadingEl);

		// setTimeout(() => {
		// 	this.hideLoading();
		// 	this.loadingEl = null;
		// }, 1000 * 10);
	}

	hideLoading() {
		this.loadingEl?.remove();
	}

	createMenuBtn() {
		
		const menu = document.createElement("div");
		menu.className = "note-menu";

		const rightBtnWrap = this.createRightBtn()

		menu.appendChild(rightBtnWrap)

		this.containerEl.appendChild(menu);
	}

	createRightBtn() {
		const rightBtnWrap = document.createElement("div")
		rightBtnWrap.className = "note-rightBtnWrap"
		const syncIcon = btoa(unescape(encodeURIComponent(ICON_NOTE_SYNC)))

		const reSyncBtn = document.createElement("div");
		reSyncBtn.className = "note-global-btn";
		reSyncBtn.innerHTML = `<img src="data:image/svg+xml;base64, ${syncIcon}">`;
		reSyncBtn.onclick = async () => {
			await this.deleteNoteLocalDatabase()
			this.loadData(this.note)
		};

		rightBtnWrap.appendChild(reSyncBtn);

		return rightBtnWrap
	}
}
