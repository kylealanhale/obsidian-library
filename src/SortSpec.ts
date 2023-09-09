export type SortDefinition = {
    sort: 'title' | 'created' | 'modified' | 'manual'
    direction: 'ascending' | 'descending'
    items: string[]
}
export interface SortSpec {
    id: string
    folders: SortDefinition
    notes: SortDefinition
}
