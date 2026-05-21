import { App, FuzzySuggestModal, TAbstractFile, TFolder } from "obsidian";

export class FolderPickerModal extends FuzzySuggestModal<TFolder> {
	private onSelect: (folder: TFolder) => void;

	constructor(app: App, onSelect: (folder: TFolder) => void) {
		super(app);
		this.onSelect = onSelect;
		this.setPlaceholder("Type to search folders…");
	}

	getItems(): TFolder[] {
		const folders: TFolder[] = [];
		const traverse = (item: TAbstractFile): void => {
			if (item instanceof TFolder) {
				folders.push(item);
				for (const child of item.children) {
					traverse(child);
				}
			}
		};
		traverse(this.app.vault.getRoot());
		return folders;
	}

	getItemText(folder: TFolder): string {
		return folder.isRoot() ? "/ (vault root)" : folder.path;
	}

	onChooseItem(folder: TFolder): void {
		this.onSelect(folder);
	}
}
