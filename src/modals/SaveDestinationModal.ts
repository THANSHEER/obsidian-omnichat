import { App, Modal, Notice, TFile } from "obsidian";
import { FilePickerModal } from "./FilePickerModal";

export class SaveDestinationModal extends Modal {
	private text: string;
	private saveNoteFolder: string;

	constructor(app: App, text: string, saveNoteFolder: string) {
		super(app);
		this.text = text;
		this.saveNoteFolder = saveNoteFolder;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h3", { text: "Save AI response" });
		contentEl.createEl("p", {
			text: "Where would you like to save this?",
			cls: "save-dest-subtitle",
		});

		const btns = contentEl.createDiv({ cls: "save-dest-buttons" });

		const newBtn = btns.createEl("button", { text: "New note", cls: "mod-cta save-dest-btn" });
		newBtn.addEventListener("click", () => { void this.saveAsNewNote(); });

		const appendBtn = btns.createEl("button", { text: "Append to existing note", cls: "save-dest-btn" });
		appendBtn.addEventListener("click", () => { this.appendToExisting(); });
	}

	private async saveAsNewNote(): Promise<void> {
		this.close();
		const folder = this.saveNoteFolder.trim() || "AI Notes";
		if (!this.app.vault.getAbstractFileByPath(folder)) {
			await this.app.vault.createFolder(folder);
		}
		const now = new Date();
		const pad = (n: number): string => String(n).padStart(2, "0");
		const name = `AI Response ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
		const path = `${folder}/${name}.md`;
		const file = await this.app.vault.create(path, this.text);
		new Notice(`Saved to ${file.path}`);
		const leaf = this.app.workspace.getLeaf(false);
		if (leaf) await leaf.openFile(file);
	}

	private appendToExisting(): void {
		this.close();
		new FilePickerModal(this.app, async (file: TFile) => {
			const existing = await this.app.vault.read(file);
			const separator = existing.trim() ? "\n\n---\n\n" : "";
			await this.app.vault.modify(file, existing + separator + this.text);
			new Notice(`Appended to ${file.path}`);
			const leaf = this.app.workspace.getLeaf(false);
			if (leaf) await leaf.openFile(file);
		}).open();
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
