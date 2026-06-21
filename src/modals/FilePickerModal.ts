import { App, FuzzySuggestModal, TFile } from "obsidian";

export class FilePickerModal extends FuzzySuggestModal<TFile> {
	private onSelect: (file: TFile) => void;

	constructor(app: App, onSelect: (file: TFile) => void) {
		super(app);
		this.onSelect = onSelect;
		this.setPlaceholder("Type to search notes…");
	}

	getItems(): TFile[] {
		// Vault enumeration is intentional: this picker exists solely to let the
		// user choose which of their own notes to add as AI context.
		return this.app.vault.getMarkdownFiles();
	}

	getItemText(file: TFile): string {
		return file.path;
	}

	onChooseItem(file: TFile): void {
		this.onSelect(file);
	}
}
