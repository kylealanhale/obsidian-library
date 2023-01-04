# Obsidian Library View

## To do

### Bugs
* sometimes can't click on note preview if preview is short (handler on wrong elem?)
* selected folder isn't indicated
* vault folder isn't treated the same

### General
* column resizing
  * √ handle
  * commands, with width calculation to match non-doubled leaves
* notes list
  * observe changes
  * perfect styles
  * clean up preview copy
    * front matter
    * redundant title
    * markup (either plain text or simple rich text)
* better native style integration
  * √ use native file explorer
  * light/dark mode.. use color variables in css
* drag and drop
* collapsed/selected state
  * unlink from stock file explorer
  * store which note is selected within folder
  * navigate to stored selected note or first note in list
  * better empty states
* sorting
  * UI
  * manual note sorting via dragging
  * stretch: manual folder sorting?

### Mobile
* mobile UI considerations
* rewrite UI in svelte/react? what's the mobile impact for that?

## Tech debt
* typescript complaints and `@ts-ignore` congesting the place
