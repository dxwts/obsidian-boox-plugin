import _ from "lodash";

export function parsePoints(data: any) {
	const len = data.length;
	const buf = data.buffer;
	const shapeView = new DataView(buf.slice(0, 4));
	const magicWord = shapeView.getInt16();
	const fileVersion = shapeView.getInt16();
	const pageUniqueId = new TextDecoder("utf-8").decode(buf.slice(4, 40));
	const revisionId = new TextDecoder("utf-8").decode(buf.slice(40, 76));
	const tmpView = new DataView(buf.slice(len - 4, len));
	const xref = tmpView.getInt32(0);
	let shapes = buf.slice(76, xref);
	let shapeIds = buf.slice(xref, len - 4);
	const shapeAttr = {
		magicWord,
		fileVersion,
		pageUniqueId,
		revisionId,
	};
	shapeIds = parseShapeMap(shapeIds);
	shapes = parseShapes(shapes, shapeIds, shapeAttr);
	return shapes;
}

export function parseShapeMap(data: any) {
	const shapeIdLen = 44;
	const len = data.byteLength;
	const arr = [];
	for (let i = 0; i < len / shapeIdLen; i++) {
		const item = data.slice(i * shapeIdLen, i * shapeIdLen + shapeIdLen);
		const view = new DataView(item);
		const shape: any = {};
		shape.uuid = new TextDecoder("utf-8").decode(item.slice(0, 36));
		shape.offset = view.getInt32(36);
		shape.length = view.getInt32(40);
		arr.push(shape);
	}
	return arr;
}

export function parseShapes(data: any, shapeIds: any, shapeAttr: any) {
	const arr = [];
	for (let i = 0; i < shapeIds.length; i++) {
		const shapeId = shapeIds[i];
		const item = data.slice(shapeId.offset - 76, shapeId.offset + 4 - 76);
		const pointData = data.slice(
			shapeId.offset + 4 - 76,
			shapeId.offset + shapeId.length - 76
		);
		const view = new DataView(item);
		const shape: any = {};
		shape.a = view.getInt16(0);
		shape.b = view.getInt16(2);
		shape.data = parseShapeData(pointData);
		const obj = Object.assign({}, shapeAttr);
		obj.shape = shape;
		obj.id = shapeId.uuid;
		arr.push(obj);
	}
	return arr;
}

export function parseShapeData(data: any) {
	const pointDataLen = 16;
	const len = data.byteLength;
	const points = [];
	for (let i = 0; i < len; i += pointDataLen) {
		const buf = data.slice(i, i + pointDataLen);
		const view = new DataView(buf);
		const point: any = {};
		point.x = view.getFloat32(0);
		point.y = view.getFloat32(4);
		point.size = view.getInt16(8);
		point.pressure = view.getInt16(10);
		point.event_time = view.getInt32(12);
		points.push(point);
		// console.log(`point: `, point)
	}
	return points;
}

export function shapeDataToBuffer(data: any) {
	const magicWordBuf = shortToBuffer(0);
	const fileVersionBuf = shortToBuffer(1);
	const pageIdBuf = stringToBuffer(data.pageUniqueId);
	const revIdBuf = stringToBuffer(data.revisionId);

	const shapes = [];
	for (const shapePoint of data.data) {
		if (!shapePoint.shape.data || shapePoint.shape.data.length === 0) {
			continue;
		}
		const shapeData = pointDataToBuffer(shapePoint.shape.data);
		shapes.push({
			id: shapePoint.id,
			length: shapeData.length,
			data: shapeData,
		});
	}

	const pointsDataLen = _.sumBy(shapes, "length");
	const shapeIdsLen = shapes.length * 44;

	const headLen =
		magicWordBuf.length +
		fileVersionBuf.length +
		pageIdBuf.length +
		revIdBuf.length;
	const xref = headLen + pointsDataLen;
	const xrefBuf = intToBuffer(xref);

	const dataLen = headLen + pointsDataLen + shapeIdsLen + xrefBuf.length;
	const shapeDataBuf = new Uint8Array(dataLen);
	let len = 0;
	shapeDataBuf.set(magicWordBuf, len);
	len = len + magicWordBuf.length;
	shapeDataBuf.set(fileVersionBuf, len);
	len = len + fileVersionBuf.length;
	shapeDataBuf.set(pageIdBuf, len);
	len = len + pageIdBuf.length;
	shapeDataBuf.set(revIdBuf, len);
	len = len + revIdBuf.length;

	for (const shapeData of shapes) {
		shapeData.offset = len;
		shapeDataBuf.set(shapeData.data, len);
		len = len + shapeData.length;
	}

	for (const shapeId of shapes) {
		delete shapeId.data;
		const buf = shapeIdToBuffer(shapeId);
		shapeDataBuf.set(buf, len);
		len = len + buf.length;
	}
	shapeDataBuf.set(xrefBuf, len);
	return shapeDataBuf;
}

export function formatShapeData(data: any) {
	const arr = grouparray(data, ["pageUniqueId", "revisionId"]);
	return arr;
}

function intToBuffer(val: any) {
	const buf = new ArrayBuffer(4);
	const view = new DataView(buf);
	view.setInt32(0, val);
	return new Uint8Array(buf);
}
function shortToBuffer(val: any) {
	const buf = new ArrayBuffer(2);
	const view = new DataView(buf);
	view.setInt16(0, val);
	return new Uint8Array(buf);
}

function stringToBuffer(str: string) {
	return new TextEncoder("utf-8").encode(str);
}

function pointDataToBuffer(points: any) {
	const aBuf = shortToBuffer(0);
	const bBuf = shortToBuffer(0);
	const pointLen = 16;
	const pointsDataBuf = new Uint8Array(4 + points.length * pointLen);
	pointsDataBuf.set(aBuf, 0);
	pointsDataBuf.set(bBuf, 2);
	for (let i = 0; i < points.length; i++) {
		const point = points[i];
		const buf = new ArrayBuffer(pointLen);
		const view = new DataView(buf);
		view.setFloat32(0, point.x);
		view.setFloat32(4, point.y);
		view.setInt16(8, point.size);
		view.setInt16(10, point.pressure);
		view.setFloat32(12, point.event_time);
		pointsDataBuf.set(new Uint8Array(buf), i * pointLen + 4);
	}
	return pointsDataBuf;
}

function shapeIdToBuffer(shapeId: any) {
	const shapeIdBuf = new Uint8Array(44);
	const idBuf = stringToBuffer(shapeId.id);
	const offsetBuf = intToBuffer(shapeId.offset);
	const lenBuf = intToBuffer(shapeId.length);
	let len = 0;
	shapeIdBuf.set(idBuf, 0);
	len = len + idBuf.length;
	shapeIdBuf.set(offsetBuf, len);
	len = len + offsetBuf.length;
	shapeIdBuf.set(lenBuf, len);
	return shapeIdBuf;
}

function genrows(groups: any, groupKey: any) {
	return _.toPairs(groups).map(([key, data]) => ({ [groupKey]: key, data }));
}

function gengroups(arr: any, iteratee: any, key: any) {
	const grouped = _.groupBy(arr, iteratee);
	return genrows(grouped, key);
}

function grouparray(data: any, props: any) {
	let result = [{ data }];

	props.map((prop: any, i: number) => {
		const key = prop || `k${i + 1}`;
		const iteratee = prop.iteratee || prop;

		result = _.flatten(
			result.map((row) => {
				return gengroups(row.data, iteratee, key).map((group) =>
					Object.assign({}, row, {
						[key]: group[key],
						data: group.data,
					})
				);
			})
		);
		return result;
	});
	return _.flatten(result);
}
