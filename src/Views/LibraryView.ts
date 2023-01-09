import { ItemView, WorkspaceLeaf, WorkspaceSplit, TFolder, TFile } from "obsidian";
import { FileExplorerViewWrapper } from "./FileExplorerViewWrapper";
import { markdownToTxt } from 'markdown-to-txt';
import fm from 'front-matter';

export const VIEW_TYPE_LIBRARY = "library-view";

export class LibraryView extends ItemView {
    foldersElement: HTMLElement
    notesElement: HTMLElement

    split: WorkspaceSplit
    foldersLeaf: WorkspaceLeaf
    notesLeaf: WorkspaceLeaf

    wrapper: FileExplorerViewWrapper

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
        this.wrapper = new FileExplorerViewWrapper(leaf, this.app, (event, folder) => {
            this.populateNotes(folder)
        });
        this.addChild(this.wrapper.view)

        this.icon = "library"
    }

    getViewType() {
        return VIEW_TYPE_LIBRARY;
    }

    getDisplayText() {
        return "Library";
    }

    async onOpen() {
        this.contentEl.empty();
        this.contentEl.addClass('library')

        // Set up split
        // @ts-ignore
        this.split = new WorkspaceSplit(this.app.workspace, 'vertical')

        // Populate folders leaf
        // @ts-ignore
        this.foldersLeaf = new WorkspaceLeaf(this.app)
        this.split.insertChild(1, this.foldersLeaf)
        this.clearEl(this.foldersLeaf.containerEl)
        this.foldersElement = this.foldersLeaf.containerEl.createDiv('library-folders')
        this.split.containerEl.appendChild(this.foldersLeaf.containerEl)
        this.foldersElement.appendChild(this.wrapper.view.containerEl)

        // Prepare notes leaf
        // @ts-ignore
        this.notesLeaf = new WorkspaceLeaf(this.app)
        this.split.insertChild(1, this.notesLeaf)
        this.clearEl(this.notesLeaf.containerEl)
        this.notesElement = this.notesLeaf.containerEl.createDiv('library-notes')
        this.split.containerEl.appendChild(this.notesLeaf.containerEl)

        // Add it all
        this.contentEl.appendChild(this.split.containerEl)
    }

    clearEl(el: Element) {
        const empties = el.querySelectorAll('.workspace-leaf-content:not([data-type="workspace-leaf-resize-handle"])')
        empties.forEach(empty => empty.parentNode?.removeChild(empty))
    }

    async populateNotes(folder: TFolder) {
        let activeNoteElement: HTMLElement
        let notesElement = this.notesElement

        this.notesElement.empty()
        let hasNotes = false
        folder.children.forEach(async child => {
            if (!(child instanceof TFile)) return;
            const file = child as TFile;
            if (file.extension != 'md') return;

            hasNotes = true

            let content = await this.getPreviewText(file)
            const container = notesElement.createDiv('library-summary-container nav-file-title')
            const noteSummary = container.createDiv('library-summary')
            noteSummary.createDiv({text: file.basename, cls: 'title'})
            noteSummary.createDiv({text: content, cls: 'content'})

            noteSummary.onClickEvent(async event => {
                if (activeNoteElement) activeNoteElement.removeClass('is-active')
                activeNoteElement = container
                activeNoteElement.addClass('is-active')

                this.app.workspace.getLeaf().openFile(file);
            })
        })

        if (!hasNotes) {
            notesElement.createDiv({text: 'No notes', cls: 'library-empty'})
        }
    }

    previewCache: Record<string, string> = {}
    async getPreviewText(file: TFile) {
        if (this.previewCache[file.path]) return this.previewCache[file.path]

        let content = await this.app.vault.cachedRead(file)
        content = fm(content).body
        content = content.slice(0, 300)
        content = markdownToTxt(content)
        this.previewCache[file.path] = content
        return content
    }
}
