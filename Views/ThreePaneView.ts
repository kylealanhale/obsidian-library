import { ItemView, WorkspaceContainer, WorkspaceItem, WorkspaceLeaf, MarkdownView, WorkspaceSplit, Vault, TFolder, TFile, TAbstractFile, View } from "obsidian";
import { ModifiedFileExplorerView } from "./ModifiedFileExplorerView";

export const VIEW_TYPE_LIBRARY = "library-view";

export class LibraryView extends ItemView {
    foldersElement: HTMLElement
    notesElement: HTMLElement

    fileExplorerView: View

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
        this.fileExplorerView = new ModifiedFileExplorerView(leaf, this.app, (event, folder) => {
            this.populateNotes(folder)
        });
        this.addChild(this.fileExplorerView)
        this.icon = "library"
    }

    getViewType() {
        return VIEW_TYPE_LIBRARY;
    }

    getDisplayText() {
        return "Notes";
    }

    async onOpen() {
        const vaultName = this.app.vault.getName()

        const container = this.containerEl.children[1];
        container.empty();
        container.addClass('library')

        this.foldersElement = container.createDiv({cls: 'folders'})
        this.notesElement = container.createDiv({cls: 'notes'})

        // Lift and shift baby
        this.foldersElement.appendChild(this.fileExplorerView.containerEl)
    }

    async populateNotes(folder: TFolder) {
        let activeNoteElement: HTMLElement
        let notesElement = this.notesElement

        notesElement.empty()
        let hasNotes = false
        folder.children.forEach(async child => {
            if (!(child instanceof TFile)) return;
            const file = child as TFile;
            if (file.extension != 'md') return;

            hasNotes = true

            let content = await this.app.vault.cachedRead(file)
            const container = notesElement.createDiv('library-summary-container nav-file-title')
            const noteSummary = container
                .createDiv('library-summary')
            noteSummary.createDiv({text: file.basename, cls: 'title'})
            noteSummary.createDiv({text: content.slice(0, 300), cls: 'content'})

            noteSummary.onClickEvent(async event => {
                if (activeNoteElement) activeNoteElement.removeClass('is-active')
                activeNoteElement = container
                activeNoteElement.addClass('is-active')

                this.app.workspace.getLeaf().openFile(file);
            })
        })

        if (!hasNotes) {
            notesElement.createDiv({text: 'No notes in this folder'})
        }
    }
}
