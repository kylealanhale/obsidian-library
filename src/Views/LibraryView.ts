import { ItemView, WorkspaceLeaf, WorkspaceSplit, TFolder, TFile, LibraryDivElement } from "obsidian";
import { FileExplorerWrapper } from "./FileExplorerViewWrapper";
import { markdownToTxt } from 'markdown-to-txt';
import fm from 'front-matter';
import LibraryPlugin from "src/main";

export const VIEW_TYPE_LIBRARY = "library-view";

export interface EventHandler {
    element: any
    name: string
    fn: Function
}


export class LibraryView extends ItemView {
    plugin: LibraryPlugin

    foldersElement: HTMLElement
    notesElement: HTMLElement
    reorderMarkerElement: HTMLElement

    split: WorkspaceSplit
    leaf: WorkspaceLeaf
    foldersLeaf: WorkspaceLeaf
    notesLeaf: WorkspaceLeaf

    wrapper: FileExplorerWrapper

    currentlyDragging: LibraryDivElement | null
    currentlyReceiving: Element

    constructor(leaf: WorkspaceLeaf, plugin: LibraryPlugin) {
        super(leaf);
        const instance = this
        this.plugin = plugin
        this.leaf = leaf
        this.wrapper = new FileExplorerWrapper(this.leaf, this.plugin, this.populateNotes.bind(this));

        this.icon = "library"
    }

    getViewType() {
        return VIEW_TYPE_LIBRARY;
    }

    getDisplayText() {
        return "Library"
    }

    async onOpen() {
        const instance = this

        // Set it up
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

        // Set up drag and drop
        this.reorderMarkerElement = this.notesLeaf.containerEl.createDiv('library-reorder-marker')
        this.handleEvent(global, 'dragover', (event: DragEvent) => {
            const parentRect = this.notesElement.getBoundingClientRect()
            const receivingTopmostChild = document.elementFromPoint(parentRect.left + 1, event.clientY) as Element
            const receivingElement = receivingTopmostChild.closest('.library-summary-container') as LibraryDivElement

            // There might be some problems hiding here due to the gap caused by the border radius
            if (!receivingElement || receivingElement == this.currentlyDragging) return

            const receivingRect = receivingElement.getBoundingClientRect()
            // Find the midpoint of the element and see if the mouse is above or below it
            const isAbove = receivingRect.top + receivingRect.height / 2 > event.clientY

            // If the mouse is above the midpoint, insert the marker above the element
            this.reorderMarkerElement.addClass('dragging')
            if (isAbove) {
                this.notesElement.insertBefore(this.reorderMarkerElement, receivingElement)
            } 
            else {
                this.notesElement.insertAfter(this.reorderMarkerElement, receivingElement)
            }
        })
        this.handleEvent(global, 'dragend', (event: DragEvent) => {
            instance.reorderMarkerElement.removeClass('dragging')

            if (!instance.currentlyDragging) return
            const currentFolder = instance.currentlyDragging.file.parent as TFolder
            const newSortIndex = instance.plugin.getCachedNotesSortIndex(currentFolder)


            function getSortOrder(element: Element | null): number | null {
                if (!element) return null
                const libraryElement = element as LibraryDivElement
                const id = instance.plugin.getId(libraryElement.file)
                return newSortIndex[id]
            }

            let previousSortOrder: number = 0, 
                previousCandidateSortOrder = getSortOrder(instance.reorderMarkerElement.previousElementSibling)
            let nextSortOrder: number = 0, 
                nextCandidateSortOrder = getSortOrder(instance.reorderMarkerElement.nextElementSibling)

            if (previousCandidateSortOrder === null && nextCandidateSortOrder !== null) {
                previousSortOrder = nextCandidateSortOrder - 1
                nextSortOrder = nextCandidateSortOrder
            }
            else if (nextCandidateSortOrder === null && previousCandidateSortOrder !== null) {
                nextSortOrder = previousCandidateSortOrder + 1
                previousSortOrder = previousCandidateSortOrder
            }
            else if (previousCandidateSortOrder === null && nextCandidateSortOrder === null) {
                console.log('Something weird is going on with the manual sorting.')
                return
            }
            else {
                previousSortOrder = previousCandidateSortOrder as number
                nextSortOrder = nextCandidateSortOrder as number
            }

            const newSortOrder = previousSortOrder + ((nextSortOrder - previousSortOrder) / 2)

            instance.plugin.setNoteSortOrder(instance.currentlyDragging.file, newSortOrder)
            instance.plugin.persistNotesSortIndex(currentFolder, newSortIndex)
            instance.populateNotes(currentFolder)

            instance.currentlyDragging = null
        })

        // Add it all 
        this.contentEl.appendChild(this.split.containerEl)
        this.addChild(this.wrapper.view)  // This triggers the wrapped view's lifecycle to start
    }

    handleEvent(element: any, name: string, fn: Function) {
        this.plugin.events.push({
            element: element,
            name: name,
            fn: fn
        })
        element.addEventListener(name, fn)
    }

    handleDragMove(el: Element) {

    }

    clearEl(el: Element) {
        const empties = el.querySelectorAll('.workspace-leaf-content:not([data-type="workspace-leaf-resize-handle"])')
        empties.forEach(empty => empty.parentNode?.removeChild(empty))
    }

    async populateNotes(folder: TFolder) {
        let activeNoteElement: HTMLElement
        let notesElement = this.notesElement
        notesElement.empty()
        let hasNotes = false

        let children = Array.from(folder.children)
        let id = this.plugin.data.ids[folder.path]
        if (id) {
            let manualSortIndex = this.plugin.data.sortIndices[id].notes
            children.sort((first, second) => {
                let firstId = this.plugin.data.ids[first.path], firstIndex = manualSortIndex[firstId] ?? Number.MAX_VALUE
                let secondId = this.plugin.data.ids[second.path], secondIndex = manualSortIndex[secondId] ?? Number.MAX_VALUE
                return firstIndex - secondIndex
            })
        }

        children.forEach(async child => {
            if (!(child instanceof TFile)) return;
            const file = child as TFile; 
            if (file.extension != 'md') return;

            hasNotes = true

            let frontmatter = this.app.metadataCache.getCache(file.path)?.frontmatter ?? {}
            let content = frontmatter.preview ? frontmatter.preview : await this.generatePreviewText(file)
            let title = frontmatter.title ?? file.basename

            if (content.startsWith(title)) content = content.slice(title.length)
            const container = notesElement.createDiv('library-summary-container nav-file-title') as LibraryDivElement
            const noteSummary = container.createDiv('library-summary')
            noteSummary.createDiv({text: title, cls: 'title'})
            noteSummary.createDiv({text: content, cls: 'content'})

            container.onClickEvent(async event => {
                if (activeNoteElement) activeNoteElement.removeClass('is-active')
                activeNoteElement = container
                activeNoteElement.addClass('is-active')

                this.app.workspace.getLeaf().openFile(file);
            })

            container.file = file

            this.plugin.app.dragManager.handleDrag(container, (event) => {
                this.plugin.app.dragManager.dragFile(event, file)
                this.currentlyDragging = container
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
