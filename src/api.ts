import BooxPlugin from "main";
import { requestUrl, Notice } from "obsidian";
import idb from "src/idb";

export default class Api {
	private static instance: Api;

	api: any;
	plugin: BooxPlugin;

	constructor(plugin: BooxPlugin) {
		this.plugin = plugin;
	}

	static getInstance(plugin: BooxPlugin) {
		if (!Api.instance) {
			Api.instance = new Api(plugin);
		}
		return Api.instance;
	}

	getBaseUrl() {
		return this.plugin.settings.server + "/api/1";
	}

	setInterceptor(params: any = {}) {
		const config: any = {
			headers: {},
		};
		const token = this.plugin.settings.token;
		if (token) {
			config.headers["Authorization"] = `Bearer ${token}`;
		}

		const accessToken = this.plugin.settings.accessToken;
		if (accessToken) {
			config.headers["access-token"] = accessToken;
		}
		return Object.assign({}, params, config);
	}

	async getToken(params?: any) {
		try {
			params = this.setInterceptor(params);
			params.url = `${this.getBaseUrl()}/users/getTokenByAccessToken`;
			const res = await requestUrl(params);
			return res.json;
		} catch (error) {
			new Notice("Access Token不正确", 3000);
		}
	}

	async getStsToken(params?: any) {
		params = this.setInterceptor(params);
		params.url = `${this.getBaseUrl()}/config/stss`;
		const res = await requestUrl(params);
		return res.json;
	}

	async getBuckets(params?: any) {
		params = this.setInterceptor(params);
		params.url = `${this.getBaseUrl()}/config/buckets`;
		const res = await requestUrl(params);
		return res.json;
	}

	async getUserInfo(params?: any) {
		params = this.setInterceptor(params);
		params.url = `${this.getBaseUrl()}/users/me`;
		const res = await requestUrl(params);
		return res.json;
	}

	async getSyncToken(params?: any) {
		params = this.setInterceptor(params);
		params.url = `${this.getBaseUrl()}/users/syncToken`;
		const res = await requestUrl(params);
		return res.json;
	}

	async getNoteChanges() {
		const channels = `${this.plugin.settings.uid}-NOTE_TREE`;
		const since =
			(await idb.getSettings(this.plugin.settings.uid, "last_seq"))
				?.data || 0;
		const url = `${this.plugin.settings.server}/neocloud/_changes?style=all_docs&filter=sync_gateway%2Fbychannel&channels=${channels}&since=${since}&limit=500`;
		const params = {
			url,
			method: "GET",
			headers: {
				Cookie: `SyncGatewaySession=${this.plugin.settings.syncToken}`,
			},
		};
		const res = await requestUrl(params);
		return res.json;
	}

	async getNoteDoc(docId: string) {
		const url = `${this.plugin.settings.server}/neocloud/${docId}`;
		const params = {
			url,
			method: "GET",
			headers: {
				Cookie: `SyncGatewaySession=${this.plugin.settings.syncToken}`,
			},
		};
		const res = await requestUrl(params);
		return res.json;
	}
}
