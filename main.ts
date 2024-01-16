import { BooxSettingTab } from "src/boox-setting-tab";
import { Notice, Plugin, addIcon, TFolder, TFile } from "obsidian";

import { Boox } from "src/boox";
import { BooxNoteView, BOOX_NOTE_VIEW_TYPE } from "src/boox-note-view";
import { BooxTextView, BOOX_TEXT_VIEW_TYPE } from "src/boox-text-view";
import Api from "src/api";
import OssUtil from "src/oss-util";
import { BASE_DIR, DATA_DIR, ICON_LOGO } from "src/constants";

import loading from "src/assets/images/loading.png";
import idb from "src/idb";

// Remember to rename these classes and interfaces!
interface BooxPluginSettings {
	accessToken: string;
	uid: string;
	token: string;
	syncToken: string;
	server: string;
	syncEnabled: boolean;
}

const DEFAULT_SETTINGS: BooxPluginSettings = {
	accessToken: "",
	uid: "",
	token: "",
	syncToken: "",
	// server: "https://send2boox.com",
	server: "https://dev.send2boox.com",
	syncEnabled: false,
};

export default class BooxPlugin extends Plugin {
	settings: BooxPluginSettings;
	boox: Boox;
	loadingEl: any;
	intervalTask: number;
	async onunload() {
		this.removeLoading();
	}
	async onload() {
		this.app.workspace.onLayoutReady(async () => {
			await this.initDataDir();
			if (this.settings?.syncEnabled) {
				this.setIntervalTask();
			}
		});

		addIcon("boox", ICON_LOGO);
		await this.loadSettings();

		Api.getInstance(this).setInterceptor(this);
		this.boox = new Boox(this.app, this);
		OssUtil.getInstance(this).init();
		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon(
			"boox",
			"BOOX",
			async (evt: MouseEvent) => {
				// Called when the user clicks the icon.
				if (this.settings.token) {
					this.boox.doAction("checkNoteTreeCreated", "");

					return new Notice("用户已登录", 3000);
				}
				const userInfo = await this.boox.getUserInfo();
				console.log("userInfo: ", userInfo);
				if (userInfo) {
					this.settings.uid = userInfo.uid;
					this.settings.token = userInfo.token;
					this.settings.syncToken = userInfo.syncToken;
					this.saveSettings();
				}
			}
		);
		ribbonIconEl.addClass("boox-plugin-ribbon-class");

		this.addSettingTab(new BooxSettingTab(this.app, this));

		this.registerView(BOOX_NOTE_VIEW_TYPE, (leaf) => {
			return new BooxNoteView(leaf, this);
		});
		this.registerExtensions(["boox"], BOOX_NOTE_VIEW_TYPE);

		this.registerView(BOOX_TEXT_VIEW_TYPE, (leaf) => {
			return new BooxTextView(leaf, this);
		});
		this.registerExtensions(["toox"], BOOX_TEXT_VIEW_TYPE);

		this.boox.subject.subscribe(async (obj: any) => {
			const { action, data } = obj;
			if (action === "syncState") {
				if (this.loadingEl) {
					this.loadingEl.style.display =
						data === "CHANGED" ? "block" : "none";
				}
			} else if (action === "syncEnabled") {
				if (data) {
					await this.initDataDir();
					this.setIntervalTask();
				} else {
					this.clearIntervals();
				}
			}
		});

		const lastOpenedFilePath = localStorage.getItem("lastOpenedFile");
		if (lastOpenedFilePath) {
			const file =
				this.app.vault.getAbstractFileByPath(lastOpenedFilePath);

			if (file instanceof TFile) {
				this.app.workspace.getLeaf().openFile(file);
			}
		}
		this.vaultOnEvent();
	}

	async initDataDir() {
		await this.setDataDir();
		setTimeout(() => {
			this.createLoading();
		}, 500);
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async vaultOnEvent() {
		this.app.vault.on("delete", async (file) => {
			if (file.path === "BOOX") {
				this.removeLoading();
				await idb.deleteSettings(this.settings.uid, "last_seq");
			}
		});
	}

	async setDataDir() {
		const dataDir = `${BASE_DIR}/${DATA_DIR}`;
		const workspace = this.app.vault.getAbstractFileByPath(BASE_DIR);

		if (!workspace || !(workspace instanceof TFolder)) {
			await this.app.vault.createFolder(dataDir);
		}
	}

	async createLoading() {
		if (this.loadingEl) return;
		const selector =
			".nav-files-container .nav-folder .tree-item-children .nav-folder div[data-path=BOOX]";
		const fileExplorer = this.app.workspace.containerEl.querySelector(
			selector
		) as HTMLElement;
		this.loadingEl = createEl("img", { cls: "loading" });
		this.loadingEl.src = loading;
		this.loadingEl.width = 15;
		this.loadingEl.height = 15;
		this.loadingEl.style.position = "absolute";
		this.loadingEl.style.right = "10px";
		this.loadingEl.style.display = "none";
		if (fileExplorer) {
			fileExplorer.style.position = "relative";
			fileExplorer.style.alignItems = "center";
			fileExplorer.appendChild(this.loadingEl);
		}
	}

	async removeLoading() {
		const selector =
			".nav-files-container .nav-folder .tree-item-children .nav-folder div[data-path=BOOX]";
		const fileExplorer = this.app.workspace.containerEl.querySelector(
			selector
		) as HTMLElement;
		if (fileExplorer && fileExplorer.contains(this.loadingEl)) {
			fileExplorer.removeChild(this.loadingEl);
		}
		this.loadingEl = null;
	}

	setIntervalTask() {
		this.registerInterval(
			(this.intervalTask = window.setInterval(async () => {
				console.log("---------------setIntervalTask----------------");
				await this.boox.doAction("getChanges", "");
			}, 5 * 1000))
		);
	}

	clearIntervals() {
		window.clearInterval(this.intervalTask);
	}
}
