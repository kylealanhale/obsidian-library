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

export type UpdateHandler = (file: TFile, parent: TFolder) => void;


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
        this.plugin = plugin
        this.leaf = leaf
        this.wrapper = new FileExplorerWrapper(this.leaf, this.plugin, this.render.bind(this));
        this.plugin.handleUpdates((file, folder) => {
            delete this.previewCache[file.path]
            this.render(folder)
        })
        this.plugin.revealInFolderCallback = () => {
            let activeFile = this.plugin.app.workspace.getActiveFile()
            if (!activeFile) return
            console.log('Reveal in folder callback triggered')
            this.wrapper.view.revealInFolder(activeFile.getParent())
        }

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

        console.log('LibraryView opened')

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
        this.handleEvent(this.notesElement, 'dragover', (event: DragEvent) => {
            const parentRect = this.notesElement.getBoundingClientRect()
            const receivingTopmostChild = document.elementFromPoint(parentRect.left + 1, event.clientY) as Element
            const receivingElement = receivingTopmostChild.closest('.library-summary-container') as LibraryDivElement

            // There might be some problems hiding here due to the gap caused by the border radius
            if (!receivingElement || receivingElement == this.currentlyDragging) {
                this.reorderMarkerElement.removeClass('dragging')
                return
            }
            this.reorderMarkerElement.addClass('dragging')

            // Find the midpoint of the element and see if the mouse is above or below it
            const receivingRect = receivingElement.getBoundingClientRect()
            const isAbove = receivingRect.top + receivingRect.height / 2 > event.clientY

            // If the mouse is above the midpoint, insert the marker above the element.
            // The position checking is important for performance reasons (`insertBefore` etc. are slow).
            if (isAbove && receivingElement.previousElementSibling != this.reorderMarkerElement) {
                this.notesElement.insertBefore(this.reorderMarkerElement, receivingElement)
            } 
            if (!isAbove && receivingElement.nextElementSibling != this.reorderMarkerElement) {
                this.notesElement.insertAfter(this.reorderMarkerElement, receivingElement)
            }
        })
        this.handleEvent(this.notesElement, 'dragend', async (event: DragEvent) => {
            instance.reorderMarkerElement.removeClass('dragging')

            // Make sure we're dragging and that the cache hasn't disappeared, which
            // happens when moving a note to a different folder
            if (!instance.currentlyDragging) return
            const currentFolder = instance.currentlyDragging.file.getParent()
            if (!instance.plugin.data.sortCache[currentFolder.path]) return

            function getSortOrder(element: Element | null): number | null {
                if (!element) return null
                const sortIndex = instance.plugin.data.sortCache[currentFolder.path].notes
                return sortIndex[(element as LibraryDivElement).file.name]
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

            // Update the sort cache and persist to spec
            let file = instance.currentlyDragging.file
            instance.plugin.data.sortCache[file.getParent().path].notes[file.name] = newSortOrder
            instance.plugin.saveLibraryData()
            instance.plugin.updateSpecSortOrder(currentFolder)

            await instance.render(currentFolder)

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

    clearEl(el: Element) {
        const empties = el.querySelectorAll('.workspace-leaf-content:not([data-type="workspace-leaf-resize-handle"])')
        empties.forEach(empty => empty.parentNode?.removeChild(empty))
    }

    async render(folder: TFolder) {
        let hasNotes = false
        let activeNoteElement: HTMLElement
        let notesElement = this.notesElement
        notesElement.empty()
        const spec = await this.plugin.getOrCreateFolderSpec(folder)

        const children = folder.children.filter((child) => child instanceof TFile) as TFile[]
        const cache = this.plugin.data.sortCache[folder.path]
        if (cache) {
            let sortIndex = cache.notes
            children.sort((first, second) => sortIndex[first.name] - sortIndex[second.name])
        }
        const previews = await Promise.all(children.map(async (child) => await this.generatePreviewText(child as TFile)))

        children
            .forEach((file, index) => {
                if (file.extension != 'md') return;

                if (spec.activeNote == file.path) {
                    this.plugin.app.workspace.getLeaf(false).openFile(file)
                }

                hasNotes = true

                let title = file.basename
                let preview = previews[index]
                if (preview.startsWith(title)) preview = preview.slice(title.length)

                // TODO: Figure out if this new hijacked approach will work
                const itemDom = this.wrapper.view.createItemDom(file)
                const container = itemDom.el as LibraryDivElement
                container.addClass('library-summary-container')
                const currentNote = this.plugin.app.workspace.getActiveFile()
                if (currentNote && currentNote.path == file.path) {
                    container.addClass('is-active')
                    activeNoteElement = container
                }

                this.notesElement.appendChild(container)
                itemDom.selfEl.createDiv({text: preview, cls: 'library-summary'})

                container.onClickEvent(async event => {
                    if (activeNoteElement) activeNoteElement.removeClass('is-active')
                    activeNoteElement = container
                    activeNoteElement.addClass('is-active')

                    this.app.workspace.getLeaf().openFile(file);

                    spec.activeNote = file.path
                    this.plugin.saveFolderSpec(file.getParent(), spec)
                })

                container.file = file

                this.plugin.app.dragManager.handleDrag(container, (event) => {
                    this.plugin.app.dragManager.dragFile(event, file)
                    let view = this.wrapper.view
                    if (view.fileBeingRenamed) return null;
                    let a = view.dragFiles(event, itemDom);
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
