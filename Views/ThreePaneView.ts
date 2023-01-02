import { ItemView, WorkspaceContainer, WorkspaceItem, WorkspaceLeaf, MarkdownView, WorkspaceSplit, Vault, TFolder, TFile, TAbstractFile } from "obsidian";

export const VIEW_TYPE_THREE_PANE_PARENT = "three-pane-parent-view";

export class ThreePaneParentView extends ItemView {
    foldersElement: HTMLElement
    notesElement: HTMLElement

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);

        //  new app.internalPlugins.plugins['file-explorer'].views['file-explorer'](app.workspace.activeLeaf)
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

        this.foldersElement = container.createDiv({cls: 'nav-folder mod-root library-folders'})
        this.notesElement = container.createDiv({cls: 'nav-folder mod-root library-notes'})

        const title = this.foldersElement.createDiv({cls: 'nav-folder-title'})
        title.createDiv("nav-folder-collapse-indicator collapse-icon")
        title.createDiv({text: vaultName, cls: 'nav-folder-title-content'})

        const rootFolder = this.app.vault.getRoot()
        const rootElement = this.foldersElement.createDiv({cls: 'nav-folder-children'})
        this.populateFolders(rootFolder, rootElement)
    }

    async populateFolders(rootFolder: TFolder, rootElement: HTMLElement) {
        let activeFolder: HTMLElement

        rootFolder.children.forEach(child => {
            if (child instanceof TFile) return;
            const folder = child as TFolder;
            const title = rootElement
                .createDiv('nav-folder')
                .createDiv({cls: 'nav-folder-title', attr: {'data-path': folder.path}})
            title.createDiv({text: child.name, cls: 'nav-folder-title-content'})

            title.onClickEvent(event => {
                if (activeFolder) activeFolder.removeClass('is-active')
                activeFolder = title
                activeFolder.addClass('is-active')

                this.populateNotes(folder)
            })
        });
    }

    async populateNotes(folder: TFolder) {
        let activeNote: HTMLElement

        this.notesElement.empty()
        folder.children.forEach(async child => {
            if (!(child instanceof TFile)) return;
            const file = child as TFile;
            if (file.extension != 'md') return;

            let content = await this.app.vault.cachedRead(file)
            const container = this.notesElement.createDiv('library-summary-container nav-file-title')
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
    }

    async onClose() {
        // Nothing to clean up.
    }
}
