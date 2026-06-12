import { App, Modal, Notice, TFile } from "obsidian";
import { FilePickerModal } from "./FilePickerModal";

export class SaveDestinationModal extends Modal {
	private text: string;
	private saveNoteFolder: string;
	private useDateSubfolder: boolean;

	constructor(app: App, text: string, saveNoteFolder: string, useDateSubfolder = false) {
		super(app);
		this.text             = text;
		this.saveNoteFolder   = saveNoteFolder;
		this.useDateSubfolder = useDateSubfolder;
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
		try {
			const baseFolder = this.saveNoteFolder.trim() || "AI Notes";
			const now        = new Date();
			const pad        = (n: number): string => String(n).padStart(2, "0");
			const dateStr    = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
			const folder     = this.useDateSubfolder ? `${baseFolder}/${dateStr}` : baseFolder;
			if (!this.app.vault.getAbstractFileByPath(folder)) {
				await this.app.vault.createFolder(folder);
			}
			const ms3  = String(now.getMilliseconds()).padStart(3, "0");
			const name = `AI Response ${dateStr} ${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}-${ms3}`;
			const path = `${folder}/${name}.md`;
			const file = await this.app.vault.create(path, this.text);
			new Notice(`Saved to ${file.path}`);
			const leaf = this.app.workspace.getLeaf(false);
			if (leaf) await leaf.openFile(file);
		} catch (err) {
			console.error("OmniChat: failed to save note", err);
			new Notice("Couldn't save the note — see console for details.");
		}
	}

	private appendToExisting(): void {
		this.close();
		new FilePickerModal(this.app, (file: TFile) => void this.appendToFile(file)).open();
	}

	private async appendToFile(file: TFile): Promise<void> {
		try {
			const existing  = await this.app.vault.read(file);
			const separator = existing.trim() ? "\n\n---\n\n" : "";
			await this.app.vault.modify(file, existing + separator + this.text);
			new Notice(`Appended to ${file.path}`);
			const leaf = this.app.workspace.getLeaf(false);
			if (leaf) await leaf.openFile(file);
		} catch (err) {
			console.error("OmniChat: failed to append to note", err);
			new Notice("Couldn't append to the note — see console for details.");
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
