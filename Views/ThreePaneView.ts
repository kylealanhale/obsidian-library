import { ItemView, WorkspaceContainer, WorkspaceItem, WorkspaceLeaf, MarkdownView, WorkspaceSplit, Vault, TFolder, TFile } from "obsidian";

export const VIEW_TYPE_THREE_PANE_PARENT = "three-pane-parent-view";

export class ThreePaneParentView extends ItemView {
    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType() {
        return VIEW_TYPE_THREE_PANE_PARENT;
    }

    getDisplayText() {
        return "Notes";
    }

    async onOpen() {
        const vaultName = this.app.vault.getName()
        this.icon = "library"
        const container = this.containerEl.children[1];
        container.empty();
        container.addClasses(['workspace-split', 'mod-left-split', 'three-pane'])

        const folders = container.createDiv({cls: 'nav-folder mod-root library-folders'})
        const title = folders.createDiv({cls: 'nav-folder-title'})
        title.createDiv({text: vaultName, cls: 'nav-folder-title-content'})

        const notes = container.createDiv({cls: 'nav-folder mod-root library-notes'})

        const children = folders.createDiv({cls: 'nav-folder-children'})
        let activeFolder: HTMLElement

        this.app.vault.getRoot().children.forEach(child => {
            if (child instanceof TFile) return;
            const folder = child as TFolder;
            const title = children
                .createDiv('nav-folder')
                .createDiv('nav-folder-title')
            title.createDiv({text: child.name, cls: 'nav-folder-title-content'})

            title.onClickEvent(event => {
                if (activeFolder) activeFolder.removeClass('is-active')
                activeFolder = title
                activeFolder.addClass('is-active')
                let activeNote: HTMLElement

                notes.empty()
                folder.children.forEach(async child => {
                    if (!(child instanceof TFile)) return;
                    const file = child as TFile;
                    if (file.extension != 'md') return;

                    let content = await this.app.vault.cachedRead(file)
                    const container = notes.createDiv('library-summary-container nav-file-title')
                    const noteSummary = container
                        .createDiv('library-summary')
                    noteSummary.createDiv({text: file.basename, cls: 'title'})
                    noteSummary.createDiv({text: content.slice(0, 300), cls: 'content'})

                    noteSummary.onClickEvent(async event => {
                        if (activeNote) activeNote.removeClass('is-active')
                        activeNote = container
                        activeNote.addClass('is-active')

                        this.app.workspace.getLeaf().openFile(file);
                    })
                })
            })
        });
    }

    async onClose() {
        // Nothing to clean up.
    }
}
