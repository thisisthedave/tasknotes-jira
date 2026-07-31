import { App, Modal, Setting } from 'obsidian';
export function showTextInputModal(app: App): Promise<string | null> {
	return new Promise((resolve) => { let settled = false; const finish = (value: string | null): void => { if (!settled) { settled = true; resolve(value); } };
		class InputModal extends Modal { value = ''; onOpen(): void { this.titleEl.setText('Import Jira issue as task'); new Setting(this.contentEl).setName('Jira issue key').addText((text) => { text.setPlaceholder('PROJ-1234').onChange((value) => { this.value = value; }); text.inputEl.addEventListener('keydown', (event) => { if (event.key === 'Enter' && this.value.trim()) { finish(this.value); this.close(); } }); window.setTimeout(() => text.inputEl.focus()); }).addButton((button) => button.setButtonText('Import').setCta().onClick(() => { if (this.value.trim()) { finish(this.value); this.close(); } })); } onClose(): void { this.contentEl.empty(); finish(null); } }
		new InputModal(app).open();
	});
}
