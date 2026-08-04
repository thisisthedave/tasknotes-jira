import { App, Modal, Setting } from 'obsidian';
import type { I18nService } from '../i18n';

/** Prompts for a Jira issue key and resolves once with the submitted value or cancellation. */
export function showTextInputModal(app: App, i18n: I18nService): Promise<string | null> {
	return new Promise((resolve) => { let settled = false; const finish = (value: string | null): void => { if (!settled) { settled = true; resolve(value); } };
		class InputModal extends Modal { value = ''; onOpen(): void { this.titleEl.setText(i18n.translate('import.modalTitle')); new Setting(this.contentEl).setName(i18n.translate('import.issueKey')).addText((text) => { text.setPlaceholder(i18n.translate('import.issueKeyPlaceholder')).onChange((value) => { this.value = value; }); text.inputEl.addEventListener('keydown', (event) => { if (event.key === 'Enter' && this.value.trim()) { finish(this.value); this.close(); } }); window.setTimeout(() => text.inputEl.focus()); }).addButton((button) => button.setButtonText(i18n.translate('import.action')).setCta().onClick(() => { if (this.value.trim()) { finish(this.value); this.close(); } })); } onClose(): void { this.contentEl.empty(); finish(null); } }
		new InputModal(app).open();
	});
}
