import { TFile, TextFileView, WorkspaceLeaf } from "obsidian";
import { fabric } from "fabric";
import { Subject } from "rxjs";
import _, { create } from "lodash";
import { LayerManager } from "@arch-inc/fabricjs-layer";

import "src/fabric/fabric_utils";
import SyncUtil from "src/sync-util";
import {
	ICON_NOTE_SYNC,
	ICON_AUDIO,
	ICON_FILE,
	ICON_PAGELINK,
	ICON_URLLINK,
	ICON_DOCLINK,
	backgroundType,
	shapeTypes,
	ICON_PREV,
	ICON_NEXT,
	ICON_TAG,
} from "src/constants";
import idb from "src/idb";
import OssUtil from "src/oss-util";
import * as Parse from "src/parse";

import Module from "src/neo_pen_wasm.js";
import { ARGBToAGBR, generateCharcoal } from "./util";
import TextboxForEllipsis from "./fabric/TextboxForEllipsis";
import BooxPlugin from "main";
import { pdfToPng } from "./pdf_util";

let wasm: any = {
	ready: () => {
		return new Promise((resolve) => {
			Module({
				TOTAL_MEMORY: 16777216 * 10,
				onRuntimeInitialized() {
					wasm = Object.assign(this, {
						ready: () => Promise.resolve("ok"),
					});
					resolve("ok");
				},
			});
		});
	},
};

export const BOOX_NOTE_VIEW_TYPE = "boox-note-view";
let isShowPageInput = false;
const isReadonly = true;
const COLOR_MODEL = [
	"Nova3Color",
	"MaxLumiColor",
	"NoteAirColor",
	"Poke2Color",
];

const textAlignMap = {
	0: "left",
	1: "right",
	2: "center",
	3: "justify",
};

export class BooxNoteView extends TextFileView {
	canvas: fabric.Canvas | null;
	file: any;
	note: any;
	subject: any;
	leaf: WorkspaceLeaf;

	loadingEl: HTMLElement | null;
	canvasContentEl: HTMLElement;
	pageInfo: any = {
		layerList: [{ id: 0, lock: false, show: true }],
	};
	layerManager: any;
	oss: any;

	shapeDbName: string;
	shapeDataDbName: string;
	resourceArr: any[] = [];
	currentPage: any;
	pages: any[] = [];
	pageState: any = {
		currentPage: 0,
		totalPage: 0,
		pageId: "",
	};
	plugin: BooxPlugin;
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
				if (!file || file.extension !== "boox") return;
				this.file = file;
				localStorage.setItem("lastOpenedFile", file.path);
			})
		);
	}

	getViewType(): string {
		return BOOX_NOTE_VIEW_TYPE;
	}

	getDisplayText(): string {
		return this.file?.basename || "";
	}

	getIcon(): string {
		return "boox";
	}

	onload(): void {
		super.onload();
		this.contentEl.empty();
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

	clear(): void {
		this.canvas = null;
		this.contentEl.empty();
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
			this.showLoading();
			await this.syncNoteData(note);
			this.pages = note.pageNameList.pageNameList;
			this.pageState.totalPage = this.pages.length;
			this.pageState.currentPage = 1;
			this.pageState.pageId = this.pages[this.pageState.currentPage - 1];
			this.updateMenuPageState();

			const pageId = this.pageState.pageId;
			this.note.shapes = await this.loadShapes();
			await this.initPage(pageId);
			await this.renderPage(pageId);
			await this.setAllActiveTags();
			this.canvas.renderAll();
			setTimeout(() => {
				this.hideLoading();
			}, 500);
		} catch (error) {
			this.contentEl.empty();
			this.hideLoading();
		}
	}

	async syncNoteData(note: any) {
		await this.SyncUtil.syncShapes(note.user, note.uniqueId);
	}

	showLoading() {
		this.loadingEl = createEl("div");
		this.loadingEl.style.position = "absolute";
		this.loadingEl.style.width = "100%";
		this.loadingEl.style.height = "100%";
		this.loadingEl.style.background = "rgba(0,0,0,0.3)";
		this.loadingEl.style.zIndex = "100";
		this.loadingEl.style.display = "flex";
		this.loadingEl.style.justifyContent = "center";
		this.loadingEl.style.alignItems = "center";
		this.loadingEl.createEl("div", { cls: "lds-dual-ring" });
		this.containerEl.appendChild(this.loadingEl);

		// setTimeout(() => {
		// 	this.hideLoading();
		// 	this.loadingEl = null;
		// }, 1000 * 10);
	}

	async setAllActiveTags(renderCanvas?: any) {
		const targetCanvas = renderCanvas || this.canvas;
		if (!targetCanvas) return;
		const result: any = {};
		this.removeSelectedTags(targetCanvas);
		targetCanvas.getObjects().forEach((item: any) => {
			if (
				item.shape &&
				item.shape.tagIdList &&
				JSON.parse(item.shape.tagIdList).length
			) {
				const key = JSON.parse(item.shape.tagIdList)[0];
				item.clone((cloned: any) => {
					Object.prototype.hasOwnProperty.call(result, key)
						? result[key].push(cloned)
						: (result[key] = [cloned]);
				});
			}
		});

		if (Object.keys(result).length === 0) return;
		if (
			targetCanvas &&
			typeof targetCanvas.getActiveObject === "function"
		) {
			targetCanvas.discardActiveObject();
		}

		for (const key in result) {
			const objs = result[key].filter(
				(obj: any) => obj.width && obj.height
			);
			const group = new fabric.Group(objs);
			const rect = group.getBoundingRect();

			this.setTagSvg(targetCanvas, rect);
		}
	}

	removeSelectedTags(targetCanvas: any) {
		targetCanvas.getObjects().forEach((item: any) => {
			if (item.selectedBG) {
				targetCanvas.remove(item);
			}
		});
	}

	setTagSvg(targetCanvas: any, rect: any) {
		fabric.loadSVGFromString(ICON_TAG, (obj: any, options: any) => {
			const svg: any = fabric.util.groupSVGElements(obj, options);
			// svg.left = rect.left
			// svg.top = rect.top
			svg.cache = true;
			svg.selectable = false;

			const currentT = svg.calcTransformMatrix();
			const transformMatrix = [
				rect.width / svg.width,
				0,
				0,
				rect.height / svg.height,
				currentT[4] - (svg.width - rect.width) / 2,
				currentT[5] - (svg.height - rect.height) / 2,
			];
			const mT = fabric.util.multiplyTransformMatrices(
				currentT,
				transformMatrix
			);
			const opts = fabric.util.qrDecompose(mT);
			svg.set(opts);
			const rectData = new fabric.Rect({
				width: rect.width,
				height: rect.height,
				stroke: "black",
				strokeWidth: 1,
				fill: "transparent",
				selectable: false,
			});

			const group: any = new fabric.Group([svg, rectData], {
				left: rect.left,
				top: rect.top,
				selectable: false,
			});

			const shape = {
				boundingRect: rect,
			};
			group.shape = shape;
			group.selectedBG = true;
			group.isTag = true;
			targetCanvas.add(group);
			group.moveTo(0);
		});
	}

	hideLoading() {
		this.loadingEl?.remove();
	}

	initLayer() {
		if (this.layerManager) {
			this.layerManager.dispose();
			this.layerManager = null;
		}
		if (!this.canvas || !this.pageInfo) {
			return;
		}
		this.layerManager = new LayerManager(this.canvas);

		const listener = {
			onLayerActivated(e: any) {
				this.canvas.activeLayer = e.layer;
			},
			onLayerRemove(e: any) {
				console.log("remove layer: ", e.layer);
			},
		};
		this.layerManager.addListener(listener);
		const layerList = this.pageInfo.layerList;
		for (let i = 0; i < layerList.length - 1; i++) {
			this.layerManager.addLayer();
		}
	}

	async initPage(pageId: string) {
		this.contentEl.empty();
		this.canvasContentEl = createEl("div", {
			attr: { id: "noteContent", class: "noteContent" },
		});
		this.canvasContentEl.style.width = "100%";
		this.canvasContentEl.style.height = "100%";

		this.contentEl.appendChild(this.canvasContentEl);

		const canvasContentRect = this.canvasContentEl.getBoundingClientRect();
		let cWidth = canvasContentRect.width;
		let cHeight = canvasContentRect.height;

		const childContentEl = createEl("div", { cls: "childContent" });
		childContentEl.style.background = "white";
		this.canvasContentEl.appendChild(childContentEl);

		const canvasEl = createEl("canvas");
		canvasEl.id = pageId;
		canvasEl.style.background = "white";
		canvasEl.width = cWidth;
		canvasEl.height = cHeight;

		let pageSize = this.note.notePageInfo
			? this.note.notePageInfo.pageInfoMap[pageId]
			: null;
		if (!pageSize) {
			pageSize = {
				layerList: [{ id: 0, lock: false, show: true }],
			};
		}
		pageSize.layerList = _.uniqBy(pageSize.layerList, "id");
		this.pageInfo = pageSize;
		const deviceSize = this.note.deviceInfo
			? this.note.deviceInfo.size
			: { width: this.note.originWidth, height: this.note.originHeight };
		this.note.originHeight =
			pageSize && pageSize.height ? pageSize.height : deviceSize.height;
		this.note.originWidth =
			pageSize && pageSize.width ? pageSize.width : deviceSize.width;
		const scaleWidth = cWidth / this.note.originWidth;
		const scaleHeight = cHeight / this.note.originHeight;
		const scale = Math.min(scaleWidth, scaleHeight);
		cWidth = this.note.originWidth * scale;
		cHeight = this.note.originHeight * scale;

		childContentEl.style.width = cWidth + "px";
		childContentEl.style.height = cHeight + "px";

		canvasEl.width = cWidth;
		canvasEl.height = cHeight;
		this.note.width = cWidth;
		this.note.height = cHeight;

		// if (this.canvas) {
		// 	this.canvas.dispose();
		// 	this.canvas = null;
		// }

		this.canvas = new fabric.Canvas(canvasEl);
		childContentEl.appendChild(canvasEl);

		if (isReadonly) {
			this.canvas.selection = false;
		}
		// this.initLayer();
		// this.canvas.offHistory();
		this.canvas.hoverCursor = "pointer";
		// this.canvas.meta = {
		// 	docId: this.note.uniqueId,
		// 	pageId: pageId,
		// 	user: this.note.user,
		// };
		this.setCanvasViewport();
		await this.setBackground(this.canvas, pageId);
	}

	setCanvasViewport() {
		if (!this.canvas) {
			return;
		}
		const scaleX = this.note.width / this.note.originWidth;
		const scaleY = this.note.height / this.note.originHeight;
		this.canvas.viewportTransform = [scaleX, 0, 0, scaleY, 0, 0];
		this.note.zoom = this.canvas.getZoom();
	}

	async setBackground(targetCanvas: any, page: string) {
		if (!targetCanvas) return;
		const obj = await this.getBackgroundRes(page);
		targetCanvas.setBackgroundColor(
			"rgba(255, 255, 255, 1)",
			targetCanvas.renderAll.bind(targetCanvas)
		);
		if (!obj) {
			return;
		}
		return new Promise((resolve, reject) => {
			if (obj.type === 0) {
				fabric.loadSVGFromURL(obj.url, (objs, opts) => {
					const bkGroundConfig =
						this.note.noteBackground.bkGroundConfig;
					const docBKGround = this.note.noteBackground.docBKGround;
					if (bkGroundConfig.scaleType === 2) {
						const patternSourceCanvas = new fabric.StaticCanvas();
						const bgObj: any = fabric.util.groupSVGElements(
							objs,
							opts
						);
						bgObj.set({
							left: 0,
							top: 0,
							scaleX: docBKGround.width / bgObj.width,
							scaleY: docBKGround.height / bgObj.height,
						});
						patternSourceCanvas.setBackgroundImage(
							bgObj,
							patternSourceCanvas.renderAll.bind(
								patternSourceCanvas
							)
						);
						patternSourceCanvas.setDimensions({
							width: docBKGround.width,
							height: docBKGround.height,
						});
						const dataURL = patternSourceCanvas.toDataURL({
							format: "png",
						});
						targetCanvas.setBackgroundColor(
							{
								source: dataURL,
								repeat: "repeat",
							},
							() => {
								targetCanvas.renderAll();
								const dataUrl = targetCanvas.toDataURL({
									format: "png",
								});
								obj.url = dataUrl;
								obj.type = 1;
								targetCanvas.background = obj;
								resolve("ok");
							}
						);
					} else {
						const bgObj = fabric.util.groupSVGElements(objs, opts);
						bgObj.set({
							left: 0,
							top: 0,
							scaleX: this.note.originWidth / bgObj.width,
							scaleY: this.note.originHeight / bgObj.height,
						});
						targetCanvas.setBackgroundImage(bgObj, () => {
							targetCanvas.renderAll();
							const dataUrl = targetCanvas.toDataURL({
								format: "png",
							});
							obj.url = dataUrl;
							obj.type = 1;
							targetCanvas.background = obj;
							resolve("ok");
						});
					}
				});
			} else if (obj.type === 2) {
				// pdf背景模版
				fabric.Image.fromURL(
					obj.url,
					(img) => {
						const opts = {
							left: 0,
							top: 0,
							scaleX: this.note.originWidth / img.width,
							scaleY: this.note.originHeight / img.height,
						};
						targetCanvas.setBackgroundImage(
							img,
							targetCanvas.renderAll.bind(targetCanvas),
							opts
						);
						const dataUrl = targetCanvas.toDataURL({
							format: "png",
						});
						obj.url = dataUrl;
						targetCanvas.background = obj;
						resolve("ok");
					},
					{
						crossOrigin: "anonymous",
					}
				);
			} else {
				fabric.Image.fromURL(
					obj.url,
					(img) => {
						const bkGroundConfig =
							this.note.noteBackground.bkGroundConfig;
						const docBKGround =
							this.note.noteBackground.docBKGround;
						img.scaleToWidth(docBKGround.width);
						img.scaleToHeight(docBKGround.height);
						if (!bkGroundConfig || bkGroundConfig.scaleType === 0) {
							const opts = {
								left: 0,
								top: 0,
								scaleX: this.note.originWidth / img.width,
								scaleY: this.note.originHeight / img.height,
							};
							targetCanvas.setBackgroundImage(
								img,
								targetCanvas.renderAll.bind(targetCanvas),
								opts
							);
							const dataUrl = targetCanvas.toDataURL({
								format: "png",
							});
							obj.url = dataUrl;
							targetCanvas.background = obj;
							resolve("ok");
						} else if (bkGroundConfig.scaleType === 1) {
							const scaleX = this.note.originWidth / img.width;
							const scaleY = this.note.originHeight / img.height;
							const scale = Math.min(scaleX, scaleY);
							const opts = {
								top: this.note.originHeight / 2,
								left: this.note.originWidth / 2,
								originX: "center",
								originY: "center",
								scaleX: scale,
								scaleY: scale,
							};
							targetCanvas.setBackgroundImage(
								img,
								targetCanvas.renderAll.bind(targetCanvas),
								opts
							);
							const dataUrl = targetCanvas.toDataURL({
								format: "png",
							});
							obj.url = dataUrl;
							targetCanvas.background = obj;
							resolve("ok");
						} else if (bkGroundConfig.scaleType === 3) {
							const scaleX = docBKGround.width / img.width;
							const scaleY = docBKGround.height / img.height;
							const scale = Math.min(scaleX, scaleY);
							const opts = {
								top: docBKGround.height / 2,
								left: docBKGround.width / 2,
								originX: "center",
								originY: "center",
								scaleX: scale,
								scaleY: scale,
							};
							targetCanvas.setBackgroundImage(
								img,
								targetCanvas.renderAll.bind(targetCanvas),
								opts
							);
							const dataUrl = targetCanvas.toDataURL({
								format: "png",
							});
							obj.url = dataUrl;
							targetCanvas.background = obj;
							resolve("ok");
						} else if (bkGroundConfig.scaleType === 2) {
							const patternSourceCanvas =
								new fabric.StaticCanvas();
							const scaleX = docBKGround.width / img.width;
							const scaleY = docBKGround.height / img.height;
							const scale = Math.min(scaleX, scaleY);
							const opts = {
								top: docBKGround.height / 2,
								left: docBKGround.width / 2,
								originX: "center",
								originY: "center",
								scaleX: scale,
								scaleY: scale,
							};
							patternSourceCanvas.setBackgroundImage(
								img,
								patternSourceCanvas.renderAll.bind(
									patternSourceCanvas
								),
								opts
							);
							patternSourceCanvas.setDimensions({
								width: docBKGround.width,
								height: docBKGround.height,
							});
							const dataURL = patternSourceCanvas.toDataURL({
								format: "png",
							});
							targetCanvas.setBackgroundColor(
								{
									source: dataURL,
									repeat: "repeat",
								},
								() => {
									targetCanvas.renderAll();
									const dataUrl = targetCanvas.toDataURL({
										format: "png",
									});
									obj.url = dataUrl;
									targetCanvas.background = obj;
									resolve("ok");
								}
							);
						}
					},
					{
						crossOrigin: "anonymous",
					}
				);
			}
		});
	}

	async getBackgroundRes(page: string) {
		let url = null;
		let type = 0;
		const bgObj = this.note.noteBackground;
		if (!bgObj) {
			return null;
		}
		let bgType = "normal";
		if (COLOR_MODEL.indexOf(this.note.deviceInfo.deviceName) !== -1) {
			bgType = "color";
		}

		if (
			bgObj.useDocBKGround ||
			(!bgObj.pageBKGroundMap[page] && bgObj.docBKGround?.value)
		) {
			if (bgObj.docBKGround.type === 0) {
				return null;
			} else if (
				bgObj.docBKGround.cloud &&
				bgObj.docBKGround.type === backgroundType.IMAGE_FILE
			) {
				url = await this.getCloudBackground(bgObj.docBKGround.resId);
				type = 1;
			} else if (
				!bgObj.docBKGround.cloud &&
				bgObj.docBKGround.type === backgroundType.IMAGE_FILE
			) {
				url = await this.getCustomBackground(bgObj.docBKGround.resId);
				if (!url) {
					url = await this.getCustomBackgroundV2(bgObj.docBKGround);
				}
				type = 1;
			} else {
				url = `https://static.send2boox.com/device/note/background/${bgType}/${bgObj.docBKGround.resId}.svg`;
			}
		} else if (bgObj.pageBKGroundMap[page]) {
			if (bgObj.pageBKGroundMap[page].type === 0) {
				return url;
			}
			if (
				bgObj.pageBKGroundMap[page].type !==
					backgroundType.IMAGE_FILE &&
				bgObj.pageBKGroundMap[page].type !== backgroundType.PDF_FILE
			) {
				url = `https://static.send2boox.com/device/note/background/${bgType}/${bgObj.pageBKGroundMap[page].resId}.svg`;
			} else if (
				bgObj.pageBKGroundMap[page].cloud &&
				bgObj.pageBKGroundMap[page].type === backgroundType.IMAGE_FILE
			) {
				url = await this.getCloudBackground(
					bgObj.pageBKGroundMap[page].resId
				);
				type = 1;
			} else if (
				!bgObj.pageBKGroundMap[page].cloud &&
				bgObj.pageBKGroundMap[page].type === backgroundType.IMAGE_FILE
			) {
				url = await this.getCustomBackground(
					bgObj.pageBKGroundMap[page].resId
				);
				if (!url) {
					url = await this.getCustomBackgroundV2(
						bgObj.pageBKGroundMap[page]
					);
				}
				type = 1;
			} else if (
				!bgObj.pageBKGroundMap[page].cloud &&
				bgObj.pageBKGroundMap[page].type === backgroundType.PDF_FILE
			) {
				url = await this.getPdfBackground(bgObj.pageBKGroundMap[page]);
				type = 2;
			} else {
				url = bgObj.pageBKGroundMap[page].resId;
			}
		}
		let obj;
		if (url) {
			obj = {
				url,
				type,
			};
		}
		return obj;
	}

	async getPdfBackground(bgObj: any) {
		const key = `${this.note.user}/note/${
			this.note.uniqueId
		}/resource/data/${bgObj.value.split("/").pop()}`;
		try {
			let res = await this.getBackground(bgObj.resId);
			if (!res) {
				const url = await this.oss.getResourceUrl(key);
				const img = await pdfToPng(url, bgObj.resIndex + 1);
				res = img;
				this.saveBackground(bgObj.resId, res);
			} else {
				res = res.data;
			}
			return res;
		} catch (error) {
			console.log("=== error: ", error);
			return null;
		}
	}

	async getCloudBackground(id: string) {
		let url;
		let res = await idb.getAssets(id);
		if (!res) {
			const apiUrl = `/api/1/writeTemplates/${id}`;
			res = await fetch(apiUrl);
			res = await res.json();
			if (res.data.file) {
				url = `https://static.send2boox.com/${res.data.file.path}`;

				res = await fetch(url);
				res = await res.blob();
				await idb.saveAssets(id, res);
			}
		} else {
			url = URL.createObjectURL(res.data);
		}
		return url;
	}

	async getCustomBackground(commitId: string) {
		let url = null;
		const key = `${this.note.user}/resource/${commitId}`;
		const imageExt = ["png", "jpg", "bmp", "jpeg"];
		for (const ext of imageExt) {
			const tmpKey = `${key}.${ext}`;
			const res = await this.oss.headFile(tmpKey);
			if (res) {
				url = await this.oss.getResourceUrl(tmpKey);
				break;
			}
		}
		return url;
	}

	async getCustomBackgroundV2(bgObj: any) {
		const filename1 = `${bgObj.resId}.${bgObj.value.split(".").pop()}`;
		const filename2 = `${bgObj.value.split("/").pop()}`;

		const key = `${this.note.user}/note/${this.note.uniqueId}/resource/data`;
		try {
			let res = await this.getBackground(bgObj.resId);
			if (!res) {
				const isExist = await this.oss.headFile(`${key}/${filename1}`);
				const url = isExist
					? await this.oss.getResourceUrl(`${key}/${filename1}`)
					: await this.oss.getResourceUrl(`${key}/${filename2}`);
				res = await fetch(url);
				res = await res.blob();
				this.saveBackground(bgObj.resId, res);
			} else {
				res = res.data;
			}

			return URL.createObjectURL(res);
		} catch (error) {
			return null;
		}
	}

	async getBackground(id: string) {
		const db: any = idb.getResourceDB(this.shapeDbName);
		const data = await db.resource.get({
			id,
			documentUniqueId: this.note.uniqueId,
		});
		return data;
	}

	async saveBackground(id: string, data: any) {
		try {
			const db: any = idb.getResourceDB(this.shapeDbName);
			const res = {
				id: id,
				documentUniqueId: this.note.uniqueId,
				data: data,
			};
			await db.resource.put(res);
		} catch (error) {
			console.log(error);
		}
	}

	async renderPage(page: string) {
		if (!page || !this.canvas) {
			return;
		}
		this.currentPage = {
			uniqueId: page,
		};

		const shapes = await this.getPageData(page);
		const tmpData = await this.getPageTmpData(page);
		this.mergeTmpShape(shapes, tmpData.shapesAttr);

		this.currentPage.count = shapes.length;
		this.currentPage.resource = shapes.filter((item: any) => {
			return item.meta.shapeType === shapeTypes.SHAPE_AUDIO;
		});
		const tmpResource = tmpData.shapes.filter((item: any) => {
			return item.meta.shapeType === shapeTypes.SHAPE_AUDIO;
		});
		this.currentPage.resource = [
			...this.currentPage.resource,
			...tmpResource,
		];
		if (shapes.length > 0) {
			this.currentPage.updatedAt =
				shapes[shapes.length - 1].meta.updatedAt;
		}

		if (this.pageInfo && this.pageInfo.layerList) {
			const layerShapes = _.groupBy(shapes, "meta.zorder");
			for (let i = 0; i < this.pageInfo.layerList.length; i++) {
				const layer = this.pageInfo.layerList[i];
				// this.layerManager.activeLayer = this.layerManager.getLayer(i);
				// this.layerManager.activeLayer = Object.assign(
				// 	this.layerManager.activeLayer,
				// 	layer
				// );
				if (layerShapes[layer.id]) {
					for (let shape of layerShapes[layer.id]) {
						if (shape.meta.shapeStatus === 1) {
							continue;
						}
						try {
							shape = await this.renderShape(shape);
							if (!shape || shape.rx < 0 || shape.ry < 0) {
								continue;
							}
							shape.synced = true;
							if (!layer.show) {
								shape.opacity = 0;
								shape.selectable = false;
							}
							this.canvas.add(shape);
						} catch (error) {
							console.error("==== renderPage: ", error);
							continue;
						}
					}
				}
			}
		} else {
			for (let shape of shapes) {
				try {
					shape = await this.renderShape(shape);
					if (!shape || shape.rx < 0 || shape.ry < 0) {
						continue;
					}
					shape.synced = true;
					this.canvas.add(shape);
				} catch (error) {
					console.error("==== renderPage: ", error);
					continue;
				}
			}
		}

		// await this.renderTmpData(tmpData.shapes);
	}

	async renderShape(shape: any) {
		const shapeId = shape.meta._id;
		if (!shape.shape.data || shape.shape.data.length < 2) {
			return null;
		}

		switch (shape.meta.shapeType) {
			case shapeTypes.SHAPE_NEO_BRUSH:
				shape.strokeType = 1;
				shape = await this.renderBrushShape(shape);
				break;
			case shapeTypes.SHAPE_BRUSH_SCRIBBLE:
				shape.strokeType = 2;
				shape = await this.renderFountainShape(shape);
				break;
			case shapeTypes.SHAPE_MARKER_SCRIBBLE:
				shape.strokeType = 3;
				shape = await this.renderMarkerShape(shape);
				break;
			case shapeTypes.SHAPE_CHARCOAL_SCRIBBLE:
				shape.strokeType = 4;
				shape = await this.renderCharcoalShape(shape);
				break;
			case shapeTypes.SHAPE_CIRCLE:
				shape = this.renderCircleShape(shape);
				break;
			case shapeTypes.SHAPE_LINE:
				shape = this.renderLineShape(shape);
				break;
			case shapeTypes.SHAPE_TRIANGLE:
				shape = this.renderTriangleShape(shape);
				break;
			case shapeTypes.SHAPE_RECTANGLE:
				shape = this.renderRectangleShape(shape);
				break;
			// case shapeTypes.SHAPE_EDIT_TEXT_SHAPE:
			// 	shape = await this.renderEditTextShape(shape);
			// 	break;
			case shapeTypes.SHAPE_IMAGE:
				shape = await this.renderImageShape(shape);
				break;
			case shapeTypes.SHAPE_AUDIO:
				shape = this.renderAudioShape(shape);
				break;
			case shapeTypes.SHAPE_REGULAR_POLYGON:
				shape = this.renderRegularPolygonShape(shape);
				break;
			case shapeTypes.SHAPE_WAVE_LINE:
				shape = this.renderWaveLineShape(shape);
				break;
			case shapeTypes.SHAPE_TRAPEZOID:
				shape = this.renderTrapezoidShape(shape);
				break;
			case shapeTypes.SHAPE_REGULAR_HEXAGON:
				shape = this.renderRegularHexagonShape(shape);
				break;
			case shapeTypes.SHAPE_ARROW_LINE:
				shape = this.renderArrowLineShape(shape);
				break;
			case shapeTypes.SHAPE_ERASE_OVERLAY:
				shape = this.renderEraseShape(shape);
				break;
			case shapeTypes.SHAPE_AREA_ERASE:
				shape = this.renderAreaEraseShape(shape);
				break;
			case shapeTypes.SHAPE_LINK:
				shape = this.renderLinkShape(shape);
				break;
			case shapeTypes.SHAPE_ATTACHMENT:
				shape = this.renderAttachmentShape(shape);
				break;
			case shapeTypes.SHAPE_TIMESTAMP:
				shape = this.renderTimeStampShape(shape);
				break;
			case shapeTypes.SHAPE_FREE:
				shape = this.renderPenShape(shape);
				break;
			case shapeTypes.SHAPE_FILL:
				shape = this.renderFillShape(shape);
				break;
			default:
				shape = this.renderPenShape(shape);
				break;
		}
		if (shape) {
			shape.id = shapeId;
		}
		if (shape && isReadonly) {
			shape.selectable = false;
		}
		return shape;
	}

	async loadShapes() {
		try {
			const db: any = await idb.getShapeDB(this.shapeDbName);
			const shapes = await db.shape.toArray();

			return shapes || [];
		} catch (error) {
			console.log(error);
		}
		return [];
	}

	async getPageData(id: string) {
		let shapesAttr = this.note.shapes.filter((item: any) => {
			return item.pageUniqueId === id;
		});

		console.log("======== shapes count: ", shapesAttr.length);

		await this.getPagePointData(shapesAttr);
		await this.getResource(id);

		const db: any = idb.getPointDB(this.shapeDataDbName);
		let shapes = await db.point.where("pageUniqueId").equals(id).toArray();
		console.log("======== shapes data count: ", shapes.length);
		shapesAttr = _.groupBy(shapesAttr, "_id");
		shapes = shapes.map((shape: any) => {
			let attr = shapesAttr[shape.id];
			if (attr) {
				attr = attr.pop();
				attr = attr.shapeStatus === 1 ? null : attr;
			}
			if (attr) {
				shape.meta = attr;
				return shape;
			}
			return null;
		});
		shapes = _.compact(shapes);
		shapes = _.orderBy(
			shapes,
			["meta.timestamp", "meta.zorder", "meta.createdAt"],
			["asc", "asc", "asc"]
		);
		const pageInfoMap = this.note.notePageInfo
			? this.note.notePageInfo.pageInfoMap[id]
			: {
					layerList: [{ id: 0, lock: false, show: true }],
			  };
		if (pageInfoMap && pageInfoMap.layerList) {
			const tmpLayerOrder = _.orderBy(
				pageInfoMap.layerList,
				["id"],
				["asc"]
			);
			const isNormalOrder = _.isEqual(
				pageInfoMap.layerList,
				tmpLayerOrder
			);
			if (!isNormalOrder) {
				shapes = _.groupBy(shapes, "meta.zorder");
				let tmpShapes: any[] = [];
				for (const layer of pageInfoMap.layerList) {
					if (shapes[layer.id]) {
						tmpShapes = [...tmpShapes, ...shapes[layer.id]];
					}
				}
				shapes = tmpShapes;
			}
		}
		console.log("======== render shapes count: ", shapes.length);
		return shapes;
	}

	async getPageTmpData(id: string) {
		const tmpShapeDB: any = idb.getTmpShapeDB(this.shapeDbName);
		const shapesAttr = await tmpShapeDB.shape
			.where("pageUniqueId")
			.equals(id)
			.toArray();

		console.log("======== tmp shapes count: ", shapesAttr.length);

		const db: any = idb.getTmpShapeDataDB(this.shapeDataDbName);
		let shapes = await db.shape.where("pageUniqueId").equals(id).toArray();
		console.log("======== tmp shapes data count: ", shapes.length);
		shapes = shapes.map((shape: any) => {
			const attr = shapesAttr.find((item: any) => {
				return item._id === shape.id;
			});
			if (attr) {
				shape.meta = attr;
				return shape;
			}
			return null;
		});
		shapes = _.compact(shapes);
		shapes = _.orderBy(shapes, ["meta.createdAt"], ["asc"]);
		console.log("======== render tmp shapes count: ", shapes.length);
		return {
			shapes: shapes,
			shapesAttr: shapesAttr,
		};
	}

	mergeTmpShape(shapes: any, tmpShapes: any) {
		for (const tmpShape of tmpShapes) {
			const shape = shapes.find((item: any) => {
				return item.meta._id === tmpShape._id;
			});
			if (shape) {
				shape.meta = Object.assign(shape.meta, tmpShape);
			}
		}
	}

	async renderTmpData(shapes: any) {
		if (!this.canvas) {
			return;
		}

		if (this.pageInfo && this.pageInfo.layerList) {
			const layerShapes = _.groupBy(shapes, "meta.zorder");
			for (let i = 0; i < this.pageInfo.layerList.length; i++) {
				const layer = this.pageInfo.layerList[i];
				this.activeLayer(layer);
				if (layerShapes[layer.id]) {
					for (let shape of layerShapes[layer.id]) {
						try {
							if (shape.meta.shapeStatus === 1) {
								continue;
							}
							shape = await this.renderShape(shape);
							if (!shape || shape.rx < 0 || shape.ry < 0) {
								continue;
							}
							shape.saved = true;
							if (!layer.show) {
								shape.opacity = 0;
								shape.selectable = false;
							}
							this.canvas.add(shape);
						} catch (error) {
							console.error("==== renderPage: ", error);
							continue;
						}
					}
				}
			}
		} else {
			for (let shape: any of shapes) {
				try {
					shape = await this.renderShape(shape);
					if (!shape || shape.rx < 0 || shape.ry < 0) {
						continue;
					}
					shape.saved = true;
					this.canvas.add(shape);
				} catch (error) {
					console.error("==== renderPage: ", error);
					continue;
				}
			}
		}
	}

	async getPagePointData(shapes: any) {
		let revArr = shapes.map((item: any) => {
			if (!item.pageUniqueId || !item.revisionId) {
				return null;
			}
			return {
				uniqueId: item.uniqueId,
				pageUniqueId: item.pageUniqueId,
				revisionId: item.revisionId,
			};
		});
		revArr = _.compact(revArr);
		revArr = _.uniqWith(revArr, _.isEqual);
		for (const doc of revArr) {
			const isExists = await this.checkShapes(doc.uniqueId);
			if (isExists) {
				continue;
			}
			try {
				const data = await this.getPagePointDataOne(doc);
				const points = Parse.parsePoints(data.content);
				await this.savePoints(points);
			} catch (error) {
				console.log(error);
				continue;
			}
		}
	}

	async getResource(id: string) {
		const db: any = idb.getResourceDB(this.shapeDbName);
		this.resourceArr = await db.resource
			.where("pageUniqueId")
			.equals(id)
			.toArray();
	}

	async checkShapes(uniqueId: string) {
		try {
			const db: any = idb.getPointDB(this.shapeDataDbName);
			const count = await db.point.where("id").equals(uniqueId).count();
			return !!count;
		} catch (error) {
			console.log(error);
		}
	}

	async getPagePointDataOne(doc: any) {
		try {
			const fileKey = `${this.note.user}/point/${doc.pageUniqueId}#${doc.revisionId}#points`;
			const data = await this.oss.getClient().get(fileKey);
			return data;
		} catch (error) {
			return await this.getPagePointDataTwo(doc);
		}
	}

	async getPagePointDataTwo(doc: any) {
		try {
			const fileKey = `${this.note.user}/note/${this.note.uniqueId}/point/${doc.pageUniqueId}#${doc.revisionId}#points`;
			const data = await this.oss.getClient().get(fileKey);
			return data;
		} catch (error) {
			throw new Error(error);
		}
	}

	async savePoints(shapes: any) {
		try {
			const db: any = idb.getPointDB(this.shapeDataDbName);
			await db.point.bulkPut(shapes);
		} catch (error) {
			console.log(error);
		}
	}

	async deleteNoteLocalDatabase() {
		await idb.deleteDB(this.shapeDbName);
		await idb.deleteDB(this.shapeDataDbName);
		await idb.deleteDB(`${this.shapeDbName}_resource`);
		await idb.deleteDB(`_tmp_${this.shapeDbName}`);
		await idb.deleteDB(`_tmp_${this.shapeDataDbName}`);

		const db: any = idb.getPBFileDB();
		const records = await db.resource
			.where("documentUniqueId")
			.equals(this.note.uniqueId)
			.toArray();
		const deletes = records.map((record: any) =>
			db.resource.delete(record.id)
		);
		await Promise.all(deletes);
	}

	renderPenShape(shape: any) {
		let fShape = this.generateLinePath(shape);
		fShape = this.setMetadata(fShape, shape);
		return fShape;
	}

	generateLinePath(shape: any) {
		let lineData = "";
		let lastDst = "";
		if (!shape.shape.data) {
			return null;
		}
		for (let i = 0; i < shape.shape.data.length; i++) {
			const point = shape.shape.data[i];
			if (!(point && point.x && point.y)) {
				continue;
			}
			if (i === 0) {
				lineData = `${lineData} M ${point.x} ${point.y}`;
				lastDst = point;
			} else {
				lineData = `${lineData} Q ${(lastDst.x + point.x) / 2} ${
					(lastDst.y + point.y) / 2
				} ${point.x} ${point.y}`;
				lastDst = point;
			}
		}
		const fShape = new fabric.Path(lineData, {
			fill: "transparent",
			stroke: this.androidColorToHex(shape.meta.color),
			objectCaching: false,
			strokeLineCap: "round",
			strokeLineJoin: "round",
			strokeWidth: shape.meta.thickness,
		});
		fShape.shape = shape.meta;
		return fShape;
	}

	setMetadata(shape: any, meta: any) {
		if (!shape) {
			return shape;
		}
		shape.originLeft = shape.left;
		shape.originTop = shape.top;
		shape.originCenter = shape.getCenterPoint();
		meta = meta.meta;
		if (!meta.matrixValues || !meta.matrixValues.values) {
			return shape;
		}

		const tM = [1, 0, 0, 1, shape.originCenter.x, shape.originCenter.y];
		const currentT = [1, 0, 0, 1, 0, 0];
		const matrix = meta.matrixValues.values;
		const transformMatrix = [
			matrix[0],
			matrix[3],
			matrix[1],
			matrix[4],
			matrix[2],
			matrix[5],
		];
		let mT = fabric.util.multiplyTransformMatrices(
			currentT,
			transformMatrix
		);
		mT = fabric.util.multiplyTransformMatrices(mT, tM);
		const options = fabric.util.qrDecompose(mT);
		shape.transformMatrix = [1, 0, 0, 1, 0, 0];
		const newCenter = {
			x: options.translateX,
			y: options.translateY,
		};
		shape.flipX = false;
		shape.flipY = false;
		shape.set(options);
		shape.setPositionByOrigin(newCenter, "center", "center");
		return shape;
	}

	androidColorToHex(color: any) {
		if (!color) {
			return "";
		}
		const [, alpha, ...colorArray] = (
			"00000000" + (parseInt(color, 10) >>> 0).toString(16)
		)
			.slice(-8)
			.match(/([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i);
		return `#${colorArray.join("")}${alpha}`;
	}

	activeLayer(layer: any) {
		const index = this.layerManager.layers.findIndex((item: any) => {
			return item.id === layer.id;
		});
		this.layerManager.activeLayer = this.layerManager.getLayer(index);
	}

	pointsToFloatArray(points: any) {
		const arr = [];
		for (let i = 0; i < points.length; i++) {
			arr.push(points[i].x);
			arr.push(points[i].y);
			arr.push(points[i].pressure / 4096);
			arr.push(points[i].size);
			arr.push(points[i].event_time);
		}
		return Float64Array.from(arr);
	}

	parseStrokePoints(pointData: any) {
		const pointDataLen = 3;
		const len = pointData.length;
		const points = [];
		for (let i = 0; i < len; i += pointDataLen) {
			const point = {};
			point.x = pointData[i + 0];
			point.y = pointData[i + 1];
			point.size = pointData[i + 2];
			points.push(point);
		}
		return points;
	}

	parseCharcoalPoints(pointData: any) {
		let offset = 0;
		const argsLen = 32;
		const buf = pointData.buffer.slice(
			pointData.byteOffset,
			pointData.byteLength + pointData.byteOffset
		);
		const arr = [];
		while (offset < pointData.byteLength) {
			const tmpBuf = buf.slice(offset, offset + argsLen);
			const point: any = {};
			const view = new DataView(tmpBuf);
			point.x = view.getFloat64(0, true);
			point.y = view.getFloat64(8, true);
			point.width = view.getFloat64(16, true);
			point.height = view.getFloat64(24, true);
			const pointEnd = offset + argsLen + point.width * point.height * 4;
			point.data = buf.slice(offset + argsLen, pointEnd);
			offset = pointEnd;
			arr.push(point);
		}
		return arr;
	}

	async computeStrokePoints(shape: any) {
		await wasm.ready();
		const points = shape.shape.data;
		const pointData = this.pointsToFloatArray(points);
		if (points.length <= 1) {
			return new Float64Array(pointData.buffer);
		}
		const len = pointData.byteLength;

		const pointsPtr = wasm._malloc(len);
		wasm.HEAP8.set(new Uint8Array(pointData.buffer), pointsPtr);

		const outPointsPtr = wasm._malloc(8);
		const outCountPtr = wasm._malloc(4);
		const configDataPtr = null;
		const configDataSize = 0;
		const color = ARGBToAGBR(shape.meta.color);
		const ret = wasm._neopen_computeStrokePoints(
			shape.strokeType,
			color,
			shape.meta.thickness,
			configDataPtr,
			configDataSize,
			pointsPtr,
			len,
			outPointsPtr,
			outCountPtr
		);
		// console.log('=== wasm ret: ', ret)
		if (ret === -1) {
			wasm._free(pointsPtr);
			wasm._free(outPointsPtr);
			wasm._free(outCountPtr);
			return null;
		}
		const outCount = wasm.getValue(outCountPtr, "i32");
		const outPoints = wasm.getValue(outPointsPtr, "i64");

		let outData;
		try {
			if (shape.shapeType === shapeTypes.SHAPE_CHARCOAL_SCRIBBLE) {
				outData = new Uint8Array(
					wasm.HEAP8.buffer,
					outPoints,
					outCount
				);
			} else if (
				shape.shapeType !== shapeTypes.SHAPE_CHARCOAL_SCRIBBLE &&
				outPoints &&
				outCount
			) {
				outData = new Float64Array(
					wasm.HEAPF64.buffer,
					outPoints,
					outCount / 8
				);
			} else {
				// outData = new Float64Array(pointData.buffer)
			}
		} catch (error) {
			console.log("===== err: ", error);
			// outData = new Float64Array(pointData.buffer)
		}

		wasm._free(pointsPtr);
		if (ret === 0) {
			wasm._neopen_releasePoints(outPoints);
		}
		wasm._free(outPointsPtr);
		wasm._free(outCountPtr);
		return outData;
	}

	generatePenObj(shape: any) {
		const paths = [];
		let lineData = null;
		let lastDst = "";
		for (let i = 0; i < shape.shape.data.length; i++) {
			const point: any = shape.shape.data[i];
			const nextPoint: any = shape.shape.data[i + 1];
			if (
				(point.x < 1 || point.y < 1) &&
				nextPoint &&
				(Math.abs(point.x - nextPoint.x) > 5 ||
					Math.abs(point.y - nextPoint.y) > 5)
			) {
				continue;
			}
			if (!lineData) {
				if (!lastDst) {
					lineData = `M ${point.x} ${point.y}`;
				} else {
					lineData = `M ${lastDst.x} ${lastDst.y}`;
				}
				lastDst = point;
			} else {
				lineData = `${lineData} Q ${(lastDst.x + point.x) / 2} ${
					(lastDst.y + point.y) / 2
				} ${point.x} ${point.y}`;
				lastDst = point;

				const opts = {
					fill: this.androidColorToHex(shape.meta.fillColor),
					stroke: this.androidColorToHex(shape.meta.color),
					strokeWidth: point.size,
					objectCaching: false,
					strokeLineCap: "round",
					strokeLineJoin: "round",
				};
				const line = new fabric.Path(lineData, opts);
				paths.push(line);
				lineData = null;
			}
		}

		const gOpts: any = {};
		if (shape.opacity) {
			gOpts.opacity = shape.opacity;
			gOpts.objectCaching = false;
		}
		let group: any = new fabric.Group(paths, gOpts);
		group = this.setMetadata(group, shape);
		group.shape = shape.meta;
		return group;
	}

	async generateCharcoalObj(shape: any) {
		const start = shape.shape.data[0];
		const end = shape.shape.data[1];
		const charcoalObj: any = await generateCharcoal(shape.shape.data);
		if (!charcoalObj) {
			return null;
		}
		let img: any = new fabric.Image(charcoalObj.img, {
			left: charcoalObj.left,
			top: charcoalObj.top,
			start: start,
			end: end,
			objectCaching: false,
		});
		img.id = shape._id;
		img.shape = shape.meta;
		img = this.setMetadata(img, shape);
		img.src = charcoalObj.url;
		return img;
	}

	generateMarkerPenObj(shape: any) {
		let lineData = null;
		let lastDst = "";
		let size = 0;
		for (let i = 0; i < shape.shape.data.length; i++) {
			const point = shape.shape.data[i];
			size = point.size;
			const nextPoint = shape.shape.data[i + 1];
			if (
				(point.x < 1 || point.y < 1) &&
				nextPoint &&
				(Math.abs(point.x - nextPoint.x) > 5 ||
					Math.abs(point.y - nextPoint.y) > 5)
			) {
				continue;
			}
			if (!lineData) {
				if (!lastDst) {
					lineData = `M ${point.x} ${point.y}`;
				} else {
					lineData = `M ${lastDst.x} ${lastDst.y}`;
				}
				lastDst = point;
			} else {
				lineData = `${lineData} Q ${(lastDst.x + point.x) / 2} ${
					(lastDst.y + point.y) / 2
				} ${point.x} ${point.y}`;
				lastDst = point;
			}
		}

		const opts = {
			fill: this.androidColorToHex(shape.meta.fillColor),
			stroke: this.androidColorToHex(shape.meta.color),
			strokeWidth: size,
			objectCaching: false,
			strokeLineCap: "round",
			strokeLineJoin: "round",
			opacity: shape.opacity,
		};
		let line = new fabric.Path(lineData, opts);
		line = this.setMetadata(line, shape);
		line.shape = shape.meta;
		return line;
	}

	async renderCharcoalShape(shape: any) {
		const shapeData = shape.shape.data;
		this.androidColorToHex(shape.meta.color);
		try {
			shape.shape.data = await this.computeStrokePoints(shape);
			if (!shape.shape.data) {
				return null;
			}
			shape.shape.data = this.parseCharcoalPoints(shape.shape.data);
			const points = shape.shape.data;
			shape = await this.generateCharcoalObj(shape);
			shape.shapeData = shapeData;
			shape.points = points;
			return shape;
		} catch (error) {
			console.log("==== ", error);
		}
		return null;
	}

	async renderBrushShape(shape: any) {
		const shapeData = shape.shape.data;
		shape.shape.data = await this.computeStrokePoints(shape);
		if (!shape.shape.data) {
			return null;
		}
		shape.shape.data = this.parseStrokePoints(shape.shape.data);
		const fShape = this.generatePenObj(shape);
		fShape.shapeData = shapeData;
		return fShape;
	}

	async renderFountainShape(shape: any) {
		const shapeData = shape.shape.data;
		shape.shape.data = await this.computeStrokePoints(shape);
		if (!shape.shape.data) {
			return null;
		}
		shape.shape.data = this.parseStrokePoints(shape.shape.data);
		const fShape = this.generatePenObj(shape);
		fShape.shapeData = shapeData;
		return fShape;
	}

	async renderMarkerShape(shape: any) {
		const shapeData = shape.shape.data;
		shape.shape.data = await this.computeStrokePoints(shape);
		if (!shape.shape.data) {
			return null;
		}
		shape.shape.data = this.parseStrokePoints(shape.shape.data);
		shape.opacity = 0.5;
		const fShape: any = this.generateMarkerPenObj(shape);
		fShape.shapeData = shapeData;
		return fShape;
	}

	renderCircleShape(shape: any) {
		const shapeData: any = shape.shape.data;
		const start = shape.shape.data[0];
		const end = shape.shape.data[1];
		const opts: any = {
			top: start.y,
			left: start.x,
			rx: (end.x - start.x) / 2,
			ry: (end.y - start.y) / 2,
			stroke: this.androidColorToHex(shape.meta.color),
			strokeWidth: shape.meta.thickness,
			fill: this.androidColorToHex(shape.meta.fillColor),
		};

		if (
			shape.meta.shapeLineStyle &&
			shape.meta.shapeLineStyle.lineStyle &&
			shape.meta.shapeLineStyle.lineStyle.dashLineIntervals
		) {
			opts.strokeDashArray =
				shape.meta.shapeLineStyle.lineStyle.dashLineIntervals;
		}

		let fShape: any = new fabric.Ellipse(opts);
		fShape.shape = shape.meta;
		fShape.start = start;
		fShape.end = end;
		fShape = this.setMetadata(fShape, shape);
		fShape.shapeData = shapeData;
		return fShape;
	}

	renderLineShape(shape: any) {
		const shapeData = shape.shape.data;
		const start = shape.shape.data[0];
		const end = shape.shape.data[1];
		const strokeWidth = shape.meta.thickness || 0;
		const points = [
			start.x - strokeWidth / 2,
			start.y - strokeWidth / 2,
			end.x - strokeWidth / 2,
			end.y - strokeWidth / 2,
		];
		const opts: any = {
			strokeWidth,
			stroke: this.androidColorToHex(shape.meta.color),
			fill: this.androidColorToHex(shape.meta.fillColor),
		};

		if (
			shape.meta.shapeLineStyle &&
			shape.meta.shapeLineStyle.lineStyle &&
			shape.meta.shapeLineStyle.lineStyle.dashLineIntervals
		) {
			opts.strokeDashArray =
				shape.meta.shapeLineStyle.lineStyle.dashLineIntervals;
		}

		let fShape: any = new fabric.Line(points, opts);
		fShape.shape = shape.meta;
		fShape.start = start;
		fShape.end = end;
		fShape = this.setMetadata(fShape, shape);
		fShape.shapeData = shapeData;
		return fShape;
	}

	renderTriangleShape(shape: any) {
		const shapeData = shape.shape.data;
		const opts: any = {
			stroke: this.androidColorToHex(shape.meta.color),
			strokeWidth: shape.meta.thickness,
			fill: this.androidColorToHex(shape.meta.fillColor),
		};
		if (
			shape.meta.shapeLineStyle &&
			shape.meta.shapeLineStyle.lineStyle &&
			shape.meta.shapeLineStyle.lineStyle.dashLineIntervals
		) {
			opts.strokeDashArray =
				shape.meta.shapeLineStyle.lineStyle.dashLineIntervals;
		}
		let fShape: any = new fabric.OTriangle(shape.shape.data, opts);
		fShape.shape = shape.meta;
		fShape = this.setMetadata(fShape, shape);
		fShape.shapeData = shapeData;
		return fShape;
	}

	renderRectangleShape(shape: any) {
		const shapeData = shape.shape.data;
		const start = shape.shape.data[0];
		const end = shape.shape.data[1];
		const strokeWidth = shape.meta.thickness || 0;
		const opts: any = {
			left: start.x - strokeWidth / 2,
			top: start.y - strokeWidth / 2,
			originX: "left",
			originY: "top",
			width: end.x - start.x,
			height: end.y - start.y,
			stroke: this.androidColorToHex(shape.meta.color),
			strokeWidth,
			fill: this.androidColorToHex(shape.meta.fillColor),
		};
		if (
			shape.meta.shapeLineStyle &&
			shape.meta.shapeLineStyle.lineStyle &&
			shape.meta.shapeLineStyle.lineStyle.dashLineIntervals
		) {
			opts.strokeDashArray =
				shape.meta.shapeLineStyle.lineStyle.dashLineIntervals;
		}
		let fShape: any = new fabric.Rect(opts);
		fShape.shape = shape.meta;
		fShape.start = start;
		fShape.end = end;
		fShape = this.setMetadata(fShape, shape);
		fShape.shapeData = shapeData;
		return fShape;
	}

	async renderImageShape(shape: any) {
		if (!shape.meta.resource) {
			return null;
		}
		const shapeData = shape.shape.data;
		const start = shape.shape.data[0];
		const end = shape.shape.data[1];
		const rect = shape.meta.boundingRect;
		const width = rect.right - rect.left;
		const height = rect.bottom - rect.top;

		const imgUrl = await this.getResUrl(shape);
		return new Promise((resolve, reject) => {
			try {
				fabric.Image.fromURL(
					imgUrl,
					(img: any) => {
						img.id = shape._id;
						img.shape = shape;
						img.start = start;
						img.end = end;
						img.left = start.x;
						img.top = start.y;

						img = this.setMetadata(img, shape);

						img.scaleToWidth(width);
						img.scaleToHeight(height);

						const centerX = start.x + width / 2;
						const centerY = start.y + height / 2;
						const matrix = shape.meta.matrixValues.values;
						const transformMatrix = [
							matrix[0],
							matrix[3],
							matrix[1],
							matrix[4],
							matrix[2],
							matrix[5],
						];
						if (
							(transformMatrix[3] === -1 &&
								!transformMatrix[4]) ||
							(transformMatrix[0] === -1 && !transformMatrix[5])
						) {
							img.set({
								originX: "center",
								originY: "center",
								left: centerX,
								top: centerY,
							});
						}
						img.pointData = shapeData;
						img.src = imgUrl;
						resolve(img);
					},
					{
						crossOrigin: "anonymous",
					}
				);
			} catch (error) {
				reject(error);
			}
		});
	}

	async renderAudioShape(shape: any) {
		if (!shape.meta.resource) {
			return null;
		} else {
			try {
				if (typeof shape.meta.resource === "string") {
					shape.meta.resource = JSON.parse(shape.meta.resource);
				}
			} catch (error) {
				console.error(error);
			}
		}

		let resUrl = await this.getResUrl(shape);
		if (!resUrl) {
			resUrl = await this.getResUrlV2(shape);
		}
		// eslint-disable-next-line no-async-promise-executor
		return new Promise(async (resolve, reject) => {
			const str = ICON_AUDIO;
			try {
				const shapeData = shape.shape.data;
				const start = shape.shape.data[0];
				const end = shape.shape.data[1];
				const rect = shape.meta.boundingRect;

				const defaultWidth = 360;
				const defaultHeight = 110;

				const currentWidth = rect.right - rect.left;
				const currentHeight = rect.bottom - rect.top;

				const width = defaultWidth;
				const height = defaultHeight;

				const svg: any = await new Promise((resolve, reject) => {
					fabric.loadSVGFromString(str, (obj, options) => {
						const svg = fabric.util.groupSVGElements(obj, options);
						svg.scaleToHeight(height * 0.6);
						svg.top = (height - svg.getScaledHeight()) / 2;
						svg.left = 20;
						svg.type = "svg";
						resolve(svg);
					});
				});

				const titleShape = new TextboxForEllipsis(
					shape.meta.resource.title,
					{
						left: svg.getScaledWidth() + 40,
						width: width - svg.getScaledWidth() - 40,
						fontSize: 36,
						fill: "#505F79",
						type: "text",
					}
				);

				titleShape.top = (height - titleShape.getScaledHeight()) / 2;

				const rectData = new fabric.Rect({
					width: width,
					height: height,
					stroke: "black",
					strokeWidth: 1,
					fill: "#fff",
					selectable: false,
					rx: 20,
					ry: 20,
					type: "rect",
				});

				const group: any = new fabric.Group(
					[rectData, svg, titleShape],
					{
						left: rect.left,
						top: rect.top,
						width: width,
						height: height,
						id: shape._id,
						objectCaching: false,
						selectable: false,
					}
				);
				group.shape = shape.meta;

				group.on("mousedblclick", (e) => {
					let title = shape.meta.resource.title;
					const fileExtension = shape.meta.resource.relativePath
						? shape.meta.resource.relativePath.split(".").pop()
						: shape.meta.resource.path.split(".").pop();
					title = title + "." + fileExtension;
					const element = createEl("a", {
						attr: { href: resUrl, download: title },
					});
					element.click();
				});

				// group = setMetadata(group, shape)
				group.start = start;
				group.end = end;
				group.shapeData = shapeData;
				group.src = resUrl;
				resolve(group);
			} catch (error) {
				console.log(error, "error");
			}
		});
	}

	// 5边形
	renderRegularPolygonShape(shape: any) {
		const shapeData = shape.shape.data;
		const opts: any = {
			stroke: this.androidColorToHex(shape.meta.color),
			strokeWidth: shape.meta.thickness,
			fill: this.androidColorToHex(shape.meta.fillColor),
		};
		if (
			shape.meta.shapeLineStyle &&
			shape.meta.shapeLineStyle.lineStyle &&
			shape.meta.shapeLineStyle.lineStyle.dashLineIntervals
		) {
			opts.strokeDashArray =
				shape.meta.shapeLineStyle.lineStyle.dashLineIntervals;
		}
		let fShape: any = new fabric.Pentagon(shape.shape.data, opts);
		fShape.shape = shape.meta;
		fShape = this.setMetadata(fShape, shape);
		fShape.shapeData = shapeData;
		return fShape;
	}

	// 6边形
	renderRegularHexagonShape(shape: any) {
		const shapeData = shape.shape.data;
		const opts: any = {
			stroke: this.androidColorToHex(shape.meta.color),
			strokeWidth: shape.meta.thickness,
			fill: this.androidColorToHex(shape.meta.fillColor),
		};
		if (
			shape.meta.shapeLineStyle &&
			shape.meta.shapeLineStyle.lineStyle &&
			shape.meta.shapeLineStyle.lineStyle.dashLineIntervals
		) {
			opts.strokeDashArray =
				shape.meta.shapeLineStyle.lineStyle.dashLineIntervals;
		}
		let fShape = new fabric.Hexagon(shape.shape.data, opts);
		fShape.shape = shape.meta;
		fShape = this.setMetadata(fShape, shape);
		fShape.shapeData = shapeData;
		return fShape;
	}

	renderWaveLineShape(shape: any) {
		const shapeData = shape.shape.data;
		const opts: any = {
			fill: this.androidColorToHex(shape.meta.fillColor),
			stroke: this.androidColorToHex(shape.meta.color),
			strokeLineCap: "round",
			strokeLineJoin: "round",
			strokeWidth: shape.meta.thickness,
		};
		if (
			shape.meta.shapeLineStyle &&
			shape.meta.shapeLineStyle.lineStyle &&
			shape.meta.shapeLineStyle.lineStyle.dashLineIntervals
		) {
			opts.strokeDashArray =
				shape.meta.shapeLineStyle.lineStyle.dashLineIntervals;
		}
		let fShape = new fabric.Wavy(shape.shape.data, opts);
		fShape.shape = shape.meta;
		fShape = this.setMetadata(fShape, shape);
		fShape.shapeData = shapeData;
		return fShape;
	}

	renderTrapezoidShape(shape: any) {
		const shapeData = shape.shape.data;
		const opts: any = {
			stroke: this.androidColorToHex(shape.meta.color),
			strokeWidth: shape.meta.thickness,
			fill: this.androidColorToHex(shape.meta.fillColor),
		};
		if (
			shape.meta.shapeLineStyle &&
			shape.meta.shapeLineStyle.lineStyle &&
			shape.meta.shapeLineStyle.lineStyle.dashLineIntervals
		) {
			opts.strokeDashArray =
				shape.meta.shapeLineStyle.lineStyle.dashLineIntervals;
		}
		let fShape = new fabric.Trapezoid(shape.shape.data, opts);
		fShape.shape = shape.meta;
		fShape = this.setMetadata(fShape, shape);
		fShape.shapeData = shapeData;
		return fShape;
	}

	renderArrowLineShape(shape: any) {
		const shapeData = shape.shape.data;
		const opts: any = {
			fill: this.androidColorToHex(shape.meta.fillColor),
			stroke: this.androidColorToHex(shape.meta.color),
			strokeLineCap: "round",
			strokeLineJoin: "round",
			strokeWidth: shape.meta.thickness,
		};
		if (
			shape.meta.shapeLineStyle &&
			shape.meta.shapeLineStyle.lineStyle &&
			shape.meta.shapeLineStyle.lineStyle.dashLineIntervals
		) {
			opts.strokeDashArray =
				shape.meta.shapeLineStyle.lineStyle.dashLineIntervals;
		}
		let fShape = new fabric.ArrowLine(shape.shape.data, opts);
		fShape.shape = shape.meta;
		fShape = this.setMetadata(fShape, shape);
		fShape.shapeData = shapeData;
		return fShape;
	}

	renderEraseShape(shape: any) {
		const shapeData = shape.shape.data;
		let fShape: any = this.generateLinePath(shape);
		fShape = this.setMetadata(fShape, shape);
		fShape.set("stroke", "#fff");
		// fShape.set('globalCompositeOperation', 'destination-out')
		fShape.shape = shape.meta;
		fShape.shapeData = shapeData;
		return fShape;
	}

	renderAreaEraseShape(shape: any) {
		const shapeData = shape.shape.data;
		const points = shapeData.map((point) => {
			return {
				x: point.x,
				y: point.y,
			};
		});
		let fShape: any = new fabric.Polygon(points, {
			stroke: null,
			strokeWidth: null,
			fill: "#fff",
			objectCaching: false,
			strokeLineCap: "round",
			strokeLineJoin: "round",
		});
		fShape = this.setMetadata(fShape, shape);
		fShape.shape = shape.meta;
		fShape.shapeData = shapeData;
		return fShape;
	}

	async getResUrl(shape: any) {
		try {
			let res = this.resourceArr.find((item) => {
				return item.id === shape.meta.resource.uniqueId;
			});
			if (!res) {
				const key = shape.meta.resource.ossUrl
					? shape.meta.resource.ossUrl
					: `${this.note.user}/note/${shape.meta.resource.documentId}/resource/data${shape.meta.resource.relativePath}`;
				res = await this.fetchResource(key);
				this.saveResource(shape, res);
			} else {
				res = res.data;
			}
			return URL.createObjectURL(res);
		} catch (error) {
			return null;
		}
	}

	async getResUrlV2(shape: any) {
		const docId = shape.meta.documentUniqueId;
		const key = `${this.note.user}/note/${docId}/resource/data${shape.meta.resource.relativePath}`;
		try {
			let res = this.resourceArr.find((item: any) => {
				return item.id === shape.meta.resource.uniqueId;
			});
			if (!res) {
				res = await this.fetchResource(key);
				this.saveResource(shape, res);
			} else {
				res = res.data;
			}
			return URL.createObjectURL(res);
		} catch (error) {
			return null;
		}
	}

	async fetchResource(key: string) {
		const url = await this.oss.getResourceUrl(key);
		let res: any = await fetch(url);
		res = await res.blob();
		return res;
	}

	async saveResource(shape: any, data: any) {
		try {
			const db: any = idb.getResourceDB(this.shapeDbName);
			const res: any = {
				id: shape.meta.resource.uniqueId,
				documentUniqueId: shape.meta.documentUniqueId,
				pageUniqueId: shape.meta.pageUniqueId,
				data: data,
			};
			await db.resource.put(res);
		} catch (error) {
			console.log(error);
		}
	}

	renderLinkShape(shape: any) {
		// eslint-disable-next-line no-async-promise-executor
		return new Promise(async (resolve) => {
			const textData = JSON.parse(shape.meta.text);

			const shapeData = shape.shape.data;
			const start = shape.shape.data[0];
			const end = shape.shape.data[1];
			const rect = shape.meta.boundingRect;
			const width = rect.right - rect.left;
			const height = rect.bottom - rect.top;
			let str = "";
			let title = "";
			const textDataKey = textData.key || "";
			if (textData.key === "URL") {
				str = ICON_URLLINK;
				title = textData.remark
					? textData.remark.replace(/\n/g, "")
					: textData.value.replace(/\n/g, "");
			} else if (textData.key === "NOTE") {
				str = ICON_PAGELINK;
				title = textData.remark
					? textData.remark.replace(/\n/g, "")
					: textData.docBean
					? textData.docBean.title
					: "";
			} else {
				str = ICON_FILE;
				title = textData.remark
					? textData.remark.replace(/\n/g, "")
					: textData.docBean
					? textData.docBean.title
					: "";
			}

			let arr: any = [];
			const displayStyle = !Object.prototype.hasOwnProperty.call(
				textData,
				"displayStyle"
			)
				? 0
				: textData.displayStyle;
			if (displayStyle === 0) {
				arr = await this.setDisplayStyle0(width, height, title, str);
			} else if (displayStyle === 1) {
				arr = await this.setDisplayStyle1(width, height, title, str);
			} else if (displayStyle === 2) {
				arr = await this.setDisplayStyle2(width, height, title, str);
			}

			const group: any = new fabric.Group(arr, {
				left: rect.left,
				top: rect.top,
				width: width,
				height: height,
				id: shape._id,
				objectCaching: false,
				selectable: false,
				displayStyle,
				textDataKey,
				linkUrl: textData.value || "",
			});
			group.shape = shape.meta;
			// group = setMetadata(group, shape)
			group.start = start;
			group.end = end;
			group.shapeData = shapeData;
			resolve(group);
		});
	}

	async setDisplayStyle0(
		width: number,
		height: number,
		title: string,
		str: string
	) {
		try {
			const svg = await new Promise((resolve, reject) => {
				fabric.loadSVGFromString(str, (obj, options) => {
					const svg: any = fabric.util.groupSVGElements(obj, options);
					svg.scaleToHeight(height * 1);
					svg.top = (height - svg.getScaledHeight()) / 2;
					svg.left = 10;
					svg.type = "svg";
					svg.icon = str;
					resolve(svg);
				});
			});

			const rectData = new fabric.Rect({
				width: width,
				height: height,
				fill: "#fff",
				selectable: false,
			});

			return [rectData, svg];
		} catch (error) {
			throw new Error(error);
		}
	}

	async setDisplayStyle1(
		width: number,
		height: number,
		title: string,
		str: string
	) {
		try {
			const svg = await new Promise((resolve, reject) => {
				fabric.loadSVGFromString(str, (obj, options) => {
					const svg: any = fabric.util.groupSVGElements(obj, options);
					svg.scaleToHeight(35);
					svg.top = (height - svg.getScaledHeight()) / 2;
					svg.left = 10;
					svg.type = "svg";
					svg.icon = str;
					resolve(svg);
				});
			});

			const svg1 = await new Promise((resolve, reject) => {
				fabric.loadSVGFromString(ICON_DOCLINK, (obj, options) => {
					const svg1: any = fabric.util.groupSVGElements(
						obj,
						options
					);
					svg1.scaleToHeight(35);
					svg1.top = (height - svg1.getScaledHeight()) / 2;
					svg1.left = width - svg1.getScaledWidth() - 10;
					svg1.type = "svg1";
					svg1.icon = ICON_DOCLINK;
					resolve(svg1);
				});
			});

			const titleShape = new TextboxForEllipsis(title, {
				left: svg.getScaledWidth() + 15,
				width:
					width - (svg.getScaledWidth() + svg1.getScaledWidth() + 35),
				fontSize: 24,
				fill: "#505F79",
				type: "text",
			});

			titleShape.top = (height - titleShape.height) / 2;

			const line = new fabric.Line([0, height, width, height], {
				stroke: "black",
				strokeWidth: 1,
				type: "line",
			});

			const rectData = new fabric.Rect({
				width: width,
				height: height,
				fill: "#fff",
				selectable: false,
				type: "rect",
			});

			return [rectData, line, svg, svg1, titleShape];
		} catch (error) {
			throw new Error(error);
		}
	}

	async setDisplayStyle2(
		width: number,
		height: number,
		title: string,
		str: string
	) {
		try {
			const svg = await new Promise((resolve, reject) => {
				fabric.loadSVGFromString(str, (obj, options) => {
					const svg: any = fabric.util.groupSVGElements(obj, options);
					svg.scaleToHeight(35);
					svg.top = (height - svg.getScaledHeight()) / 2;
					svg.left = 10;
					svg.type = "svg";
					svg.icon = str;
					resolve(svg);
				});
			});

			const svg1 = await new Promise((resolve, reject) => {
				fabric.loadSVGFromString(ICON_DOCLINK, (obj, options) => {
					const svg1: any = fabric.util.groupSVGElements(
						obj,
						options
					);
					svg1.scaleToHeight(35);
					svg1.top = (height - svg1.getScaledHeight()) / 2;
					svg1.left = width - svg1.getScaledWidth() - 10;
					svg1.type = "svg1";
					svg1.icon = ICON_DOCLINK;
					resolve(svg1);
				});
			});

			const titleShape = new TextboxForEllipsis(title, {
				left: svg.getScaledWidth() + 15,
				width:
					width - (svg.getScaledWidth() + svg1.getScaledWidth() + 35),
				fontSize: 24,
				fill: "#505F79",
				type: "text",
			});

			titleShape.top = (height - titleShape.height) / 2;

			const rectData = new fabric.Rect({
				width: width,
				height: height,
				stroke: "black",
				strokeWidth: 1,
				fill: "#fff",
				selectable: false,
				rx: 20,
				ry: 20,
				type: "rect",
			});

			return [rectData, svg, svg1, titleShape];
		} catch (error) {
			throw new Error(error);
		}
	}

	renderAttachmentShape(shape: any) {
		if (!shape.meta.resource) {
			return null;
		} else {
			try {
				if (typeof shape.meta.resource === "string") {
					shape.meta.resource = JSON.parse(shape.meta.resource);
				}
			} catch (error) {
				console.error("===== error: ", error);
			}
		}

		// eslint-disable-next-line no-async-promise-executor
		return new Promise(async (resolve) => {
			const str = ICON_FILE;

			let resUrl = await this.getResUrl(shape);
			if (!resUrl) {
				resUrl = await this.getResUrlV2(shape);
			}

			const shapeData = shape.shape.data;
			const start = shape.shape.data[0];
			const end = shape.shape.data[1];
			const rect = shape.meta.boundingRect;
			const width = rect.right - rect.left;
			const height = rect.bottom - rect.top;

			const svg = await new Promise((resolve, reject) => {
				fabric.loadSVGFromString(str, (obj, options) => {
					const svg = fabric.util.groupSVGElements(obj, options);
					svg.scaleToHeight(40);
					svg.top = (height - svg.getScaledHeight()) / 2;
					svg.left = 10;
					svg.type = "svg";
					resolve(svg);
				});
			});

			const filename = shape.meta.resource.relativePath.split("/").pop();
			const title = shape.meta.resource.title || filename;
			const titleShape = new TextboxForEllipsis(title, {
				left: svg.getScaledWidth() + 15,
				width: width - svg.getScaledWidth() - 15,
				fontSize: 30,
				fill: "#505F79",
				type: "text",
			});

			titleShape.top = (height - titleShape.height) / 2;

			// const titleShape2 = new TextboxForEllipsis('pzzzzzz', {
			//     left: svg.getScaledWidth() + 15,
			//     width: width - svg.getScaledWidth() - 15,
			//     fontSize: 22,
			//     fill: '#505F79',
			//     top: titleShape.height + 15,
			// })

			const rectData = new fabric.Rect({
				width: width,
				height: height,
				stroke: "black",
				strokeWidth: 1,
				fill: "#fff",
				selectable: false,
				rx: 20,
				ry: 20,
				type: "rect",
			});

			const group: any = new fabric.Group([rectData, svg, titleShape], {
				left: rect.left,
				top: rect.top,
				width: width,
				height: height,
				id: shape._id,
				objectCaching: false,
				selectable: false,
			});
			group.shape = shape.meta;
			group.on("mousedblclick", async (e) => {
				// const url = await getResUrlV2(shape)
				const element = createEl("a", {
					attr: { href: resUrl, download: filename },
				});
				element.click();
			});
			// group = setMetadata(group, shape)
			group.start = start;
			group.end = end;
			group.shapeData = shapeData;
			group.src = resUrl;
			resolve(group);
		});
	}

	renderTimeStampShape(shape: any) {
		const shapeData = shape.shape.data;
		const start = shape.shape.data[0];
		const end = shape.shape.data[1];
		const rect = shape.meta.boundingRect;
		const width = rect.right - rect.left;
		const height = rect.bottom - rect.top;
		const arr = [];
		const textData = JSON.parse(shape.meta.text);
		if (!textData.noFrame) {
			const rectData = new fabric.Rect({
				width: width,
				height: height,
				stroke: "black",
				strokeWidth: 1,
				fill: "#fff",
				selectable: false,
				rx: 20,
				ry: 20,
				type: "rect",
			});
			arr.push(rectData);
		}
		const titleShape = new TextboxForEllipsis(
			textData.timestampBean.formattedStr,
			{
				width: width,
				textAlign: "center",
				fontSize: 26,
				fill: "#505F79",
				type: "text",
			}
		);
		titleShape.top = (height - titleShape.getScaledHeight()) / 2;
		arr.push(titleShape);

		const group: any = new fabric.Group(arr, {
			left: rect.left,
			top: rect.top,
			width: width,
			height: height,
			id: shape._id,
			objectCaching: false,
			selectable: false,
		});

		group.shape = shape.meta;

		group.start = start;
		group.end = end;
		group.shapeData = shapeData;
		return group;
	}

	renderFillShape(shape: any) {
		const shapeData = shape.shape.data;
		const rects = [];

		for (let i = 0; i < shapeData.length - 1; i += 2) {
			let rect = new fabric.Rect({
				left: shapeData[i].x,
				top: shapeData[i].y,
				width: shapeData[i + 1].x - shapeData[i].x,
				height: shapeData[i + 1].y - shapeData[i].y,
				stroke: this.androidColorToHex(shape.meta.fillColor),
				fill: this.androidColorToHex(shape.meta.fillColor),
				strokeWidth: shape.meta.thickness,
			});

			rect = this.setMetadata(rect, shape);
			rects.push(rect);
		}
		const group = new fabric.Group(rects);
		group.url = group.toDataURL();
		group.shapeData = shapeData;
		group.shape = shape.meta;
		return group;
	}

	prevPage() {
		if (this.pageState.currentPage > 1) {
			this.pageState.currentPage--;
			this.goToPage(this.pageState.currentPage);
		}
	}

	nextPage() {
		console.log("=== next page");
		if (this.pageState.currentPage < this.pageState.totalPage) {
			this.pageState.currentPage++;
			this.goToPage(this.pageState.currentPage);
		}
	}

	async goToPage(page: number) {
		if (page < 1 || page > this.pageState.totalPage) {
			return;
		}
		this.pageState.currentPage = page;
		this.pageState.pageId = this.pages[page - 1];
		this.showLoading();
		this.updateMenuPageState();
		await this.initPage(this.pageState.pageId);
		await this.renderPage(this.pageState.pageId);
		await this.setAllActiveTags();
		this.canvas.renderAll();
		this.hideLoading();
	}

	updateMenuPageState() {
		const currentPage: any = document.querySelector(
			".pageBtnWrap-currentPage"
		);
		const totalPage: any = document.querySelector(".pageBtnWrap-total");
		const pageInput: any = document.querySelector(".pageBtnWrap-input");
		pageInput.value = this.pageState.currentPage;
		currentPage.textContent = this.pageState.currentPage;
		totalPage.textContent = this.pageState.totalPage;
	}

	showPageInput() {
		const pageInfo: any = document.querySelector(".pageBtnWrap-page-info");
		const pageInput: any = document.querySelector(".pageBtnWrap-input");
		if (isShowPageInput) {
			// pageInput.oninput = (e: any) => {
			// 	const value = parseInt(e.target.value);
			// 	this.goToPage(value);
			// };

			pageInput.onblur = () => {
				let value = parseInt(pageInput.value);
				if (value > this.pageState.totalPage) {
					value = this.pageState.totalPage;
				} else if (value < 1) {
					value = 1;
				}
				this.goToPage(value);
				isShowPageInput = false;
				this.showPageInput();
			};

			pageInput.onkeydown = (e: any) => {
				if (e.key === "Enter") {
					pageInput.blur();
				}
			};

			pageInput.style.display = "flex";
			pageInput.select();
			pageInfo.style.display = "none";
		} else {
			pageInput.style.display = "none";
			pageInput.onblur = null;
			pageInput.onkeydown = null;
			pageInfo.style.display = "flex";
		}
	}

	createMenuBtn() {
		const menu = createEl("div", { cls: "note-menu" });

		const rightBtnWrap = this.createRightBtn();
		const pageBtnWrap = this.createPageBtn();

		menu.appendChild(rightBtnWrap);
		menu.appendChild(pageBtnWrap);

		this.containerEl.appendChild(menu);
	}

	createRightBtn() {
		const rightBtnWrap = createEl("div", { cls: "note-rightBtnWrap" });
		const syncIcon = btoa(unescape(encodeURIComponent(ICON_NOTE_SYNC)));

		const reSyncBtn = createEl("div", { cls: "note-global-btn" });
		reSyncBtn.createEl("img", {
			attr: { src: `data:image/svg+xml;base64, ${syncIcon}` },
		});
		reSyncBtn.onclick = async () => {
			await this.deleteNoteLocalDatabase();
			this.loadData(this.note);
		};

		rightBtnWrap.appendChild(reSyncBtn);

		return rightBtnWrap;
	}

	createPageBtn() {
		const pageBtnWrap = createEl("div", { cls: "note-pageBtnWrap" });

		const prevBtn = createEl("div", { cls: "note-global-btn" });
		prevBtn.createEl("img", {
			attr: { src: `data:image/svg+xml;base64, ${btoa(ICON_PREV)}` },
		});
		prevBtn.onclick = () => {
			this.prevPage();
		};

		const nextBtn = createEl("div", { cls: "note-global-btn" });
		nextBtn.createEl("img", {
			attr: { src: `data:image/svg+xml;base64, ${btoa(ICON_NEXT)}` },
		});
		nextBtn.onclick = () => {
			this.nextPage();
		};

		const pageCtx = createEl("div", { cls: "pageBtnWrap-ctx" });
		const pageInfo = createEl("div", { cls: "pageBtnWrap-page-info" });
		pageInfo.createEl("div", {
			cls: ["pageBtnWrap-page-item", "pageBtnWrap-currentPage"],
			text: this.pageState.currentPage,
		});
		pageInfo.createEl("span", {
			cls: ["pageBtnWrap-page-item", "pageBtnWrap-separator"],
			text: "/",
		});
		pageInfo.createEl("div", {
			cls: ["pageBtnWrap-page-item", "pageBtnWrap-total"],
			text: this.pageState.totalPage,
		});
		pageInfo.onclick = () => {
			isShowPageInput = true;
			this.showPageInput();
		};

		const pageInput = createEl("input", {
			attr: {
				type: "number",
				id: "menuPageInput",
				class: "pageBtnWrap-input",
				value: this.pageState.currentPage,
			},
		});

		pageCtx?.appendChild(pageInfo);
		pageCtx?.appendChild(pageInput);

		pageBtnWrap.appendChild(prevBtn);
		pageBtnWrap.appendChild(pageCtx);
		pageBtnWrap.appendChild(nextBtn);

		return pageBtnWrap;
	}
}
