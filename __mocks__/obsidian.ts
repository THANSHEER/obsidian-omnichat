/* eslint-disable @typescript-eslint/no-explicit-any */
// Minimal stubs for the Obsidian API so tests run in Node without Electron.

export class App {
	vault: any = {
		getMarkdownFiles: () => [],
		getRoot: () => new TFolder(),
		getAbstractFileByPath: () => null,
		read: () => Promise.resolve(""),
	};
	workspace: any = {
		getActiveFile: () => null,
		getLeavesOfType: () => [],
		getRightLeaf: () => null,
		revealLeaf: () => Promise.resolve(),
		onLayoutReady: (cb: () => void) => cb(),
	};
}

export class Plugin {
	app: App = new App();
	manifest: Record<string, unknown> = {};
	addCommand(_cmd: unknown): void {}
	addRibbonIcon(_icon: string, _title: string, _cb: () => void): void {}
	addSettingTab(_tab: unknown): void {}
	registerView(_type: string, _factory: unknown): void {}
	loadData(): Promise<unknown> { return Promise.resolve({}); }
	saveData(_data: unknown): Promise<void> { return Promise.resolve(); }
}

export class PluginSettingTab {
	containerEl: any = {
		empty: (): void => {},
	};
	constructor(_app: unknown, _plugin: unknown) {}
}

export class Setting {
	constructor(_containerEl: unknown) {}
	setName(_name: string): this { return this; }
	setDesc(_desc: string): this { return this; }
	setHeading(): this { return this; }
	addToggle(_cb: (t: any) => void): this {
		_cb({ setValue: () => ({ onChange: () => {} }) });
		return this;
	}
	addDropdown(_cb: (d: any) => void): this {
		_cb({
			addOption: () => ({}),
			setValue: () => ({}),
			onChange: () => ({}),
		});
		return this;
	}
	addText(_cb: (t: any) => void): this {
		_cb({ setPlaceholder: () => ({ setValue: () => ({ onChange: () => {} }) }) });
		return this;
	}
	addTextArea(_cb: (t: any) => void): this {
		_cb({ setPlaceholder: () => ({ setValue: () => ({ onChange: () => {} }) }) });
		return this;
	}
}

export class Notice {
	constructor(public message: string, public timeout?: number) {}
}

export class WorkspaceLeaf {
	view: any = null;
	setViewState(_state: unknown): Promise<void> { return Promise.resolve(); }
	detach(): void {}
}

export class ItemView {
	contentEl: any = {
		empty: (): void => {},
		addClass: (_cls: string): void => {},
		removeClass: (_cls: string): void => {},
		createDiv: (_opts?: unknown): any => ({}),
	};
	leaf: WorkspaceLeaf;
	app: App = new App();
	constructor(leaf: WorkspaceLeaf) { this.leaf = leaf; }
	getViewType(): string { return ""; }
	getDisplayText(): string { return ""; }
	getIcon(): string { return ""; }
	async onOpen(): Promise<void> {}
	async onClose(): Promise<void> {}
}

export class TAbstractFile {
	path = "";
	name = "";
}

export class TFile extends TAbstractFile {
	basename = "";
	extension = "md";
}

export class TFolder extends TAbstractFile {
	children: TAbstractFile[] = [];
	isRoot(): boolean { return false; }
}

export abstract class FuzzySuggestModal<T> {
	app: App;
	constructor(app: App) { this.app = app; }
	abstract getItems(): T[];
	abstract getItemText(item: T): string;
	abstract onChooseItem(item: T, evt: MouseEvent | KeyboardEvent): void;
	setPlaceholder(_text: string): void {}
	open(): void {}
	close(): void {}
}

export class Editor {
	getSelection(): string { return ""; }
	replaceSelection(_text: string): void {}
}
