import Api from "src/api";
import BooxPlugin from "main";
import { App, TFolder, TFile } from 'obsidian'

import idb from "src/idb";

import http from "http";
import _ from "lodash";
import { Subject } from "rxjs";

export class Boox {
	app: App;
	plugin: BooxPlugin;
	api: Api;
	subject: Subject<any>;
	uid: string;

	constructor(app: App, plugin: BooxPlugin) {
		this.app = app;
		this.plugin = plugin;
		this.api = Api.getInstance(this.plugin);
		this.uid = this.plugin.settings.uid;
		this.subject = new Subject();
		this.subject.subscribe((data: any) => {
			this.handleAction(data.action, data.data);
		});
	}

	async createFolder(folder: string) {
		const workspace = this.app.vault.getAbstractFileByPath(folder)
		
		if (!workspace || !(workspace instanceof TFolder)) {
			try {
				await this.app.vault.createFolder(folder);
			} catch (error) {
				console.log(error);
				return false;
			}
		}

		return false;
	}

	async createNote(note: any) {
		const file = this.app.vault.getAbstractFileByPath(note.path);
		
		if (!file || !(file instanceof TFile)) {
			try {
				await this.app.vault.create(note.path, note.content);
				return true;
			} catch (error) {
				console.log(error);
			}
		}

		return false;
	}

	fotmatNotes(notes: any) {
		const map: Record<any, any> = {};
		const formattedNotes: any = [];

		for (let i = 0; i < notes.length; i++) {
			const node = notes[i];

			map[node.uniqueId] = i;
			node.children = [];
		}

		for (let i = 0; i < notes.length; i++) {
			const node = notes[i];

			if (node.parentUniqueId) {
				if (!map[node.parentUniqueId]) {
					continue;
				}

				notes[map[node.parentUniqueId]].children.push(node);
			} else {
				formattedNotes.push(node);
			}
		}

		return formattedNotes;
	}

	async createNotes(baseDir: string, notes: any) {
		for (const item of notes) {
			let created = false;

			if (item.type === 0) {   // folder
				const path = `${baseDir}/${item.title}`;

				created = await this.createFolder(path);
				await this.createNotes(path, item.children);
			} else if (item.type === 1) {   // file
				const ext = !item.activeScene ? "boox" : "toox";
				const name = `${baseDir}/${item.title}.${ext}`;

				created = await this.createNote({
					path: name,
					content: `${JSON.stringify(item)}`,
				});
			}

			if (created) {
				try {
					await idb.updateCreatedNoteTree(this.uid, item.uniqueId, 1);
				} catch (error) {
					console.log(error);
				}
			}
		}
	}

	//获取用户信息
	async getUserInfo() {
		try {
			const tokenRes = await this.api.getToken();
			this.plugin.settings.token = tokenRes.data;

			const userRes = await this.api.getUserInfo();
			this.plugin.settings.uid = userRes.data.uid;

			const syncTokenRes = await this.api.getSyncToken();
			this.plugin.settings.syncToken = syncTokenRes.data.session_id;

			return {
				token: tokenRes.data,
				uid: userRes.data.uid,
				syncToken: syncTokenRes.data.session_id,
			};
		} catch (error) {
			console.log(error);
		}
	}

	request(options: any) {
		return new Promise((resolve, reject) => {
			const req = http.request(options, (res) => {
				let data = "";

				res.on("data", (chunk) => {
					data += chunk;
				});

				res.on("end", () => {
					resolve(data);
				});
			});

			req.on("error", (error) => {
				reject(error);
			});
			
			req.end();
		});
	}

	async getLastSeq() {
		try {
			const res = await idb.getSettings(this.uid, "last_seq");
			
			return res?.data || 0;
		} catch (error) {
			return 0
		}
	}

	async saveLastSeq(lastSeq: number) {
		try {
			await idb.saveSettings(this.uid, "last_seq", lastSeq);
		} catch (error) {
			console.log(error);
		}
	}

	async doAction(action: string, data: any) {
		this.subject.next({
			action: action,
			data: data,
		});
	}

	async handleAction(action: string, data: any) {
		switch (action) {
			case "getChanges": {
				const res = await this.getChanges();

				this.subject.next({
					action: "saveDocs",
					data: res,
				});
				
				break;
			}
			case "saveDocs":
				this.saveDocs(data);
				break;
			case "checkNoteTreeCreated":
				this.checkNoteTreeCreated();
				break;
			default:
				break;
		}
	}

	async getChanges() {
		const channels = `${this.plugin.settings.uid}-NOTE_TREE`;
		const since = await this.getLastSeq();
		const host = this.plugin.settings.server.split('//')[1]
		const opts = {
			hostname: host,
			path: `/neocloud/_changes?style=all_docs&filter=sync_gateway%2Fbychannel&channels=${channels}&since=${since}&limit=500`,
			method: "GET",
			headers: {
				Cookie: `SyncGatewaySession=${this.plugin.settings.syncToken}`,
			}
		};
		
		try {
			let data: any = await this.request(opts);
			data = JSON.parse(data)
			if (!data?.results.length) {
				this.subject.next({ action: 'syncState', data: 'UNCHANGED' });
			} else {
				this.subject.next({ action: 'syncState', data: 'CHANGED' });
			}

			return data;
		} catch (error) {
			return {};
		}
	}

	async saveDocs(data: any) {
		if (_.isEmpty(data)) {
			return;
		}
		try {
			const arr = [];
			for (const doc of data.results) {
				arr.push(this.getDoc(doc.id));
			}
			await Promise.all(arr);
			await this.saveLastSeq(data.last_seq);
			setTimeout(() => {
				this.checkNoteTreeCreated();
			}, 1000);
		} catch (error) {
			console.log(error);
		}
	}

	async getDoc(docId: string) {
		const host = this.plugin.settings.server.split('//')[1]
		const opts = {
			hostname: host,
			path: `/neocloud/${docId}`,
			method: "GET",
			headers: {
				Cookie: `SyncGatewaySession=${this.plugin.settings.syncToken}`,
			}
		};
		try {
			let data: any = await this.request(opts);
			data = JSON.parse(data);
			if(data?.title){
				await idb.saveNoteTree(this.uid, data.uniqueId, data);
			}
			return true;
		} catch (e) {
			return false;
		}
	}

	async checkNoteTreeCreated() {
		let notes: any[] = await idb.getUnCreatedNoteTree(this.uid);

		if (_.isEmpty(notes) || notes.length === 0) {
			return;
		}

		notes = notes.reduce((acc, cur) => {
			if (cur.data.type === 0 || cur.data.type === 1) {
				acc.push(cur.data);
			}

			return acc
		}, [])
		
		notes = this.fotmatNotes(notes);
		console.log('number of fotmated notes:', notes.length)

		this.createNotes("BOOX", notes);
	}
}
