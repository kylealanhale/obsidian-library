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
        this.wrapper = new FileExplorerWrapper(this.leaf, this.plugin, this.populateNotes.bind(this));
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
            console.log('dragend', event)
            instance.reorderMarkerElement.removeClass('dragging')

            if (!instance.currentlyDragging) return
            const currentlyDragging = instance.currentlyDragging as LibraryDivElement
            const currentlyDraggingFolder = currentlyDragging.file.parent as TFolder
            const currentlyDraggingFolderId = instance.plugin.libraryData.ids[currentlyDraggingFolder.path]
            const currentlyDraggingFileId = instance.plugin.libraryData.ids[currentlyDragging.file.path]
            const manualSortIndex = instance.plugin.libraryData.manualSortIndices[currentlyDraggingFolderId].notes


            function getManualSortOrder(element: LibraryDivElement): number | null {
                if (!element) return null
                
                const folder = element.file.parent as TFolder
                const folderId = instance.plugin.libraryData.ids[folder.path]
                const id = instance.plugin.libraryData.ids[element.file.path]
                return manualSortIndex[id]
            }

            let previousManualSortOrder: number = 0, previousManualSortOrderCandidate = getManualSortOrder(instance.reorderMarkerElement.previousElementSibling as LibraryDivElement)
            let nextManualSortOrder: number = 0, nextManualSortOrderCandidate = getManualSortOrder(instance.reorderMarkerElement.nextElementSibling as LibraryDivElement)

            if (previousManualSortOrderCandidate === null && nextManualSortOrderCandidate !== null) {
                previousManualSortOrder = nextManualSortOrderCandidate - 1
                nextManualSortOrder = nextManualSortOrderCandidate
            }
            else if (nextManualSortOrderCandidate === null && previousManualSortOrderCandidate !== null) {
                nextManualSortOrder = previousManualSortOrderCandidate + 1
                previousManualSortOrder = previousManualSortOrderCandidate
            }
            else if (previousManualSortOrderCandidate === null && nextManualSortOrderCandidate === null) {
                console.log('Something weird is going on with the manual sorting.')
                return
            }
            else {
                previousManualSortOrder = previousManualSortOrderCandidate as number
                nextManualSortOrder = nextManualSortOrderCandidate as number
            }

            const newSortOrder = previousManualSortOrder + ((nextManualSortOrder - previousManualSortOrder) / 2)

            manualSortIndex[currentlyDraggingFileId] = newSortOrder
            instance.plugin.saveSortOrderForFolder(currentlyDraggingFolder, manualSortIndex)
            instance.populateNotes(currentlyDraggingFolder)

            instance.currentlyDragging = null
        })

        // Add it all 
        this.contentEl.appendChild(this.split.containerEl)
        this.addChild(this.wrapper.view)  // This triggers the wrapped view's lifecycle to start
    }

    handleEvent(element: any, name: string, fn: Function) {
        this.plugin.eventHandlers.push({
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
        let id = this.plugin.libraryData.ids[folder.path]
        if (id) {
            let manualSortIndex = this.plugin.libraryData.manualSortIndices[id].notes
            children.sort((first, second) => {
                let firstId = this.plugin.libraryData.ids[first.path], firstIndex = manualSortIndex[firstId] ?? Number.MAX_VALUE
                let secondId = this.plugin.libraryData.ids[second.path], secondIndex = manualSortIndex[secondId] ?? Number.MAX_VALUE
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

            /// For debugging
            const currentlyDraggingId = this.plugin.libraryData.ids[folder.path]
            const manualSortIndex = this.plugin.libraryData.manualSortIndices[currentlyDraggingId].notes
            // TODO: For some reason notes without a manual sort order are taking on the order of another note
            //console.log(manualSortIndex)
            const id = this.plugin.libraryData.ids[file.path]
            const order = manualSortIndex[id]
            title = `${title} (${order}, ${id})`
            /////////////////////

            if (content.startsWith(title)) content = content.slice(title.length)
            const container = notesElement.createDiv('library-summary-container nav-file-title') as LibraryDivElement
            const noteSummary = container.createDiv('library-summary')
            noteSummary.createDiv({text: `${title} (${order}, ${id})`, cls: 'title'})
            noteSummary.createDiv({text: content, cls: 'content'})

            container.onClickEvent(async event => {
                if (activeNoteElement) activeNoteElement.removeClass('is-active')
                activeNoteElement = container
                activeNoteElement.addClass('is-active')

                this.app.workspace.getLeaf().openFile(file);
            })

            container.file = file

            this.plugin.app.dragManager.handleDrag(container, (event) => {
                console.log('dragging', event)
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
