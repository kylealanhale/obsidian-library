import { ItemView, WorkspaceLeaf, WorkspaceSplit, TFolder, TFile } from "obsidian";
import { FileExplorerWrapper } from "./FileExplorerViewWrapper";
import { markdownToTxt } from 'markdown-to-txt';
import fm from 'front-matter';
import LibraryPlugin from "src/main";

export const VIEW_TYPE_LIBRARY = "library-view";

export class LibraryView extends ItemView {
    plugin: LibraryPlugin

    foldersElement: HTMLElement
    notesElement: HTMLElement

    split: WorkspaceSplit
    foldersLeaf: WorkspaceLeaf
    notesLeaf: WorkspaceLeaf

    wrapper: FileExplorerWrapper

    constructor(leaf: WorkspaceLeaf, plugin: LibraryPlugin) {
        super(leaf);
        this.plugin = plugin
        this.wrapper = new FileExplorerWrapper(leaf, this.plugin, (event, folder) => {
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
        this.foldersLeaf.containerEl.addClass('library-folders-container')
        this.split.insertChild(1, this.foldersLeaf)
        this.clearEl(this.foldersLeaf.containerEl)
        this.foldersElement = this.foldersLeaf.containerEl.createDiv('library-folders')
        this.split.containerEl.appendChild(this.foldersLeaf.containerEl)
        this.foldersElement.appendChild(this.wrapper.view.containerEl)

        // Prepare notes leaf
        // @ts-ignore
        this.notesLeaf = new WorkspaceLeaf(this.app)
        this.notesLeaf.containerEl.addClass('library-notes-container')
        this.split.insertChild(1, this.notesLeaf)
        this.clearEl(this.notesLeaf.containerEl)
        this.notesElement = this.notesLeaf.containerEl.createDiv('library-notes')
        this.split.containerEl.appendChild(this.notesLeaf.containerEl)

        // Add it all 
        this.contentEl.appendChild(this.split.containerEl)

        // Open to last location
        // this.wrapper.revealCurrentPath()  // Currently causes an error and I'm not sure why
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

        let children = Array.from(folder.children)
        let id = this.plugin.libraryData.ids[folder.path]
        console.log('before:')
        children.forEach(child => console.log(`* ${this.plugin.libraryData.ids[child.path]}: ${child.name}`))
        if (id) {
            let manualSortIndex = this.plugin.libraryData.manualSortIndices[id].notes
            console.log('sort index:', manualSortIndex)
            children.sort((first, second) => {
                let firstId = this.plugin.libraryData.ids[first.path], firstIndex = manualSortIndex[firstId] ?? Number.MAX_VALUE
                let secondId = this.plugin.libraryData.ids[second.path], secondIndex = manualSortIndex[secondId] ?? Number.MAX_VALUE
                console.log(`sort indices: ${firstId}: ${manualSortIndex[firstId]} => ${firstIndex}, ${secondId}: ${manualSortIndex[secondId]}, => ${secondIndex}`)
                return firstIndex - secondIndex
            })
        }
        console.log('after:')
        children.forEach(child => console.log(`* ${this.plugin.libraryData.ids[child.path]}: ${child.name}`))

        children.forEach(async child => {
            if (!(child instanceof TFile)) return;
            const file = child as TFile; 
            if (file.extension != 'md') return;

            hasNotes = true

            let frontmatter = this.app.metadataCache.getCache(file.path)?.frontmatter ?? {}
            let content = frontmatter.preview ? frontmatter.preview : await this.generatePreviewText(file)
            let title = frontmatter.title ?? file.basename
            if (content.startsWith(title)) content = content.slice(title.length)
            const container = notesElement.createDiv('library-summary-container nav-file-title')
            const noteSummary = container.createDiv('library-summary')
            noteSummary.createDiv({text: title, cls: 'title'})
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
    async generatePreviewText(file: TFile) {
        if (this.previewCache[file.path]) return this.previewCache[file.path]

        let content = await this.app.vault.cachedRead(file)
        content = fm(content).body
        content = content.slice(0, 300)
        content = markdownToTxt(content)
        this.previewCache[file.path] = content
        return content
    }
}
