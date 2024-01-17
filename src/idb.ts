import Dexie from "dexie";

export default {
	getShapeDB(name: string, ver = 1) {
		const db = new Dexie(name);
		db.version(ver).stores({
			shape: "&_id, magicWord, fileVersion, pageUniqueId, shapeType, revisionId, shape, updatedAt",
		});
		return db;
	},

	getPointDB(name: string, ver = 1) {
		const db = new Dexie(name);
		db.version(ver).stores({
			point: "&id, magicWord, fileVersion, pageUniqueId, revisionId, shape",
		});
		return db;
	},

	getTmpCommitDB(name: string, ver = 1) {
		name = `_tmp_${name}`;
		const db = new Dexie(name);
		db.version(ver).stores({
			commit: "&_id, documentUniqueId, pageUniqueId, user, commitId",
		});
		return db;
	},

	getTmpShapeDB(name: string, ver = 1) {
		name = `_tmp_${name}`;
		const db = new Dexie(name);
		db.version(ver).stores({
			shape: "&_id, documentUniqueId, pageUniqueId, user",
		});
		return db;
	},

	getTmpShapeDataDB(name: string, ver = 1) {
		name = `_tmp_${name}`;
		const db = new Dexie(name);
		db.version(ver).stores({
			shape: "&id, magicWord, fileVersion, pageUniqueId, revisionId, shape, [pageUniqueId+revisionId]",
		});
		return db;
	},

	getResourceDB(name: string, ver = 1) {
		name = `${name}_resource`;
		const db = new Dexie(name);
		db.version(ver).stores({
			resource: "&id, pageUniqueId, documentUniqueId",
		});
		return db;
	},

	getAssetsDB() {
		const ver = 1;
		const name = "boox_assets";
		const db = new Dexie(name);
		db.version(ver).stores({
			resource: "&id",
		});
		return db;
	},

	getPouchDB(name: string) {
		name = `_pouch_${name}`;
		const db = new Dexie(name);
		return db.open();
	},

	getPBFileDB() {
		const ver = 1;
		const name = "boox_pb_file";
		const db = new Dexie(name);
		db.version(ver).stores({
			resource: "&id, documentUniqueId, status",
		});
		return db;
	},

	async putTmpShape(name: string, data = {}) {
		try {
			const tab = this.getTmpShpeDB(name).shape;
			// let shape = await tab.get({_id: data._id, _rev: data._rev})
			// if (!shape) {
			//   shape = data
			// } else {
			//   shape = Object.assign(shape, data)
			// }
			const res = await tab.put(data);
			return res;
		} catch (error) {
			console.error(error);
		}
	},

	async putTmpShapeData(name: string, data = {}) {
		try {
			const tab = this.getTmpShapeDataDB(name).shape;
			const res = await tab.put(data);
			return res;
		} catch (error) {
			throw new Error(error);
		}
	},

	async saveAssets(id: string, data: any) {
		try {
			const db = this.getAssetsDB();
			const res = {
				id: id,
				data: data,
			};
			await db.resource.put(res);
		} catch (error) {
			throw new Error(error);
		}
	},

	async getAssets(id: string) {
		try {
			const db = this.getAssetsDB();
			const resource = await db.resource.get(id);
			return resource;
		} catch (error) {
			throw new Error(error);
		}
	},

	getCacheDB() {
		const ver = 1;
		const name = "boox_cache";
		const db = new Dexie(name);
		db.version(ver).stores({
			note: "&id",
			page: "&id, documentUniqueId, height, pageUniqueId, width, updatedAt, count",
		});
		return db;
	},

	getSettingDB(uid: string) {
		const ver = 1;
		const name = `${uid}_settings`;
		const db = new Dexie(name);
		db.version(ver).stores({
			settings: "&id",
		});
		return db;
	},

	async saveSettings(uid: string, id: string, data: any) {
		try {
			const db = this.getSettingDB(uid);
			const res = {
				id: id,
				data: data,
			};
			await db.settings.put(res);
		} catch (error) {
			throw new Error(error);
		}
	},

	async deleteSettings(uid: string, id: string) {
		try {
			const db = this.getSettingDB(uid);
			await db.settings.delete(id);
		} catch (error) {
			throw new Error(error);
		}
	},

	async getSettings(uid: string, id: string) {
		try {
			const db = this.getSettingDB(uid);
			const settings = await db.settings.get(id);
			return settings;
		} catch (error) {
			throw new Error(error);
		}
	},

	getNoteTreeDB(uid: string) {
		const ver = 1;
		const name = `${uid}_note_tree`;
		const db = new Dexie(name);
		db.version(ver).stores({
			note: "&id, isCreated, isSynced",
		});
		return db;
	},

	async saveNoteTree(uid: string, id: string, data: any) {
		try {
			const db = this.getNoteTreeDB(uid);
			const res = {
				id: id,
				isSynced: 0,
				isCreated: 0,
				data: data,
			};
			await db.note.put(res);
		} catch (error) {
			throw new Error(error);
		}
	},

	async getNoteTree(uid: string, id: string) {
		try {
			const db = this.getNoteTreeDB(uid);
			const note = await db.note.get(id);
			return note;
		} catch (error) {
			throw new Error(error);
		}
	},

	async updateNoteTree(uid: string, id: string, attr: any = {}, data: any) {
		try {
			const db = this.getNoteTreeDB(uid);
			const res = {
				id: id,
				...attr,
				data: data,
			};
			await db.note.update(id, res);
		} catch (error) {
			throw new Error(error);
		}
	},

	async updateCreatedNoteTree(uid: string, id: string, isCreated = 0) {
		try {
			const db = this.getNoteTreeDB(uid);
			const res = {
				id: id,
				isCreated: isCreated,
			};
			await db.note.update(id, res);
		} catch (error) {
			throw new Error(error);
		}
	},

	async updateSyncedNoteTree(uid: string, id: string, isSynced = 0) {
		try {
			const db = this.getNoteTreeDB(uid);
			const res = {
				id: id,
				isSynced: isSynced,
			};
			await db.note.update(id, res);
		} catch (error) {
			throw new Error(error);
		}
	},

	async getUnCreatedNoteTree(uid: string) {
		try {
			const db = this.getNoteTreeDB(uid);
			const note = await db.note.where({ isCreated: 0 }).toArray();
			return note;
		} catch (error) {
			throw new Error(error);
		}
	},

	async saveCacheNote(note: any) {
		try {
			const db = this.getCacheDB();
			note = await db.note.put(note);
		} catch (error) {
			throw new Error(error);
		}
	},

	async getCacheNote(id: string) {
		try {
			const db = this.getCacheDB();
			const note = await db.note.get(id);
			return note;
		} catch (error) {
			throw new Error(error);
		}
	},

	async saveCachePage(page: any) {
		try {
			const db = this.getCacheDB();
			page = await db.page.put(page);
		} catch (error) {
			throw new Error(error);
		}
	},

	async getCachePage(id: string) {
		try {
			const db = this.getCacheDB();
			const page = await db.page.get(id);
			return page;
		} catch (error) {
			throw new Error(error);
		}
	},

	async deleteDB(name: string) {
		return Dexie.delete(name);
	},

	async DbIsExists(name: string) {
		const res = await Dexie.exists(name);
		return res;
	},
};
