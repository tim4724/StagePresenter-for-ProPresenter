"use strict"

const flexibleSlides = true
const alignLeftCharactersThreshold = 80

function PresentationDomUpdater() {
    let onResizeTimout = undefined
    window.onresize = function () {
        clearTimeout(onResizeTimout)
        onResizeTimout = setTimeout(function() {
            scrollToCurrentSlide(true)
        }, 500)
    }
    const groupTemplate = document.querySelector('.group')
    groupTemplate.parentElement.removeChild(groupTemplate)
    groupTemplate.removeAttribute('id');

    const titleElement = document.getElementById('title')
    const presentationContainerElement = document.getElementById('presentationContainer')
    const bottomSpacer = presentationContainerElement.querySelector('#bottomSpacer')

    const scroller = Scroller(presentationContainerElement)

    function displayPresentation(presentation, slideIndex, animate) {
        if (animate) {
            presentationContainer.style.opacity = 0
            setTimeout(function () {
                display()
                presentationContainerElement.scrollTo(0, 0)
                presentationContainer.style.opacity = 1
                changeCurrentSlideAndScroll(slideIndex, true)
            }, 500)
        } else {
            display()
            changeCurrentSlideAndScroll(slideIndex, false)
        }

        function display() {
            // Remove old elements from DOM
            const groupElements = presentationContainerElement.querySelectorAll('.group')
            groupElements.forEach(e => e.parentElement.removeChild(e))

            // Update elements
            titleElement.innerHTML = presentation.name
            titleElement.style.display = presentation.name ? 'block' : 'none'

            // Insert new elements
            for (const group of presentation.groups) {
                const groupElement = buildGroupElement(group)
                presentationContainerElement.insertBefore(groupElement, bottomSpacer)
            }

            // Hide the first group if it only contains empty slides
            const firstGroupSlides = presentation.groups[0].slides
            if (!firstGroupSlides || !firstGroupSlides.every(s => s.lines.some(l => l.length > 0))) {
                const firstGroup = presentationContainerElement.querySelector('.group')
                firstGroup.style.display = 'none'
            }
        }
    }

    function insertGroupToPresentation(group, index = 0) {
        const groupElement = buildGroupElement(group)
        const insertedBeforeCurrent = index <= getCurrentSlideIndex()

        const groups = presentationContainerElement.getElementsByClassName('group')
        const elementBefore = index < groups.length ? groups[index] : bottomSpacer
        presentationContainerElement.insertBefore(groupElement, elementBefore)

        if (insertedBeforeCurrent) {
            scrollToCurrentSlide(false)
        }
    }

    function buildGroupElement(group) {
        const groupElement = groupTemplate.cloneNode(true)
        groupElement.querySelector('.groupName').innerHTML = group.name
        groupElement.querySelector('.groupName').style.color = group.color
        groupElement.style.borderColor = group.color

        for (const slide of group.slides) {
            const slideElement = document.createElement('div')
            slideElement.classList.add('slide')
            if (flexibleSlides) {
                slideElement.classList.add('flexibleSlide')
            }

            if (slide.lines && slide.lines.some(l => l.length > alignLeftCharactersThreshold)) {
                groupElement.classList.add('groupWithLongText')
            }

            if (slide.isBiblePassage) {
                slideElement.classList.add('biblePassage')
            }

            for (let i = 0; i < slide.lines.length; i++) {
                const line = slide.lines[i]

                const lineSpan = document.createElement('span')
                lineSpan.classList.add('line')

                if (slide.bibleVerseNumbers && i < slide.bibleVerseNumbers.length) {
                    const bibleVerseSpan = document.createElement('span')
                    bibleVerseSpan.innerText = slide.bibleVerseNumbers[i]
                    bibleVerseSpan.classList.add('bibleVerseNumber')

                    lineSpan.appendChild(bibleVerseSpan)
                }

                const textSpan = document.createElement('span')
                textSpan.classList.add('text')
                textSpan.innerText = line.trim()

                lineSpan.appendChild(textSpan)
                slideElement.appendChild(lineSpan)
            }

            groupElement.appendChild(slideElement)
        }

        if (group.containsBiblePassage) {
            groupElement.classList.add('groupWithBiblePassage')
        }
        if (group.slides.length == 0 || !group.slides.every(s => s.lines.some(l => l.length > 0))) {
            groupElement.classList.add('emptyGroup')
        }
        return groupElement
    }

    function getCurrentSlideIndex() {
        const slides = presentationContainerElement.getElementsByClassName('slide')
        const currentSlide = presentationContainerElement.querySelector('.currentSlide')
        return Array.prototype.indexOf.call(slides, currentSlide)
    }

    function changeCurrentSlideAndScroll(slideIndex, animate = true) {
        const slides = presentationContainerElement.getElementsByClassName('slide')
        if (!slides || slides.length === 0) {
            return
        }

        const oldSlide = presentationContainerElement.querySelector('.currentSlide')
        const newSlide = slides[Math.min(slideIndex, slides.length -1)]
        const newSlideIsHidden = newSlide && newSlide.parentElement.style.display === 'none'

        if (oldSlide) {
            oldSlide.parentNode.classList.remove('currentGroup')
            if (newSlide && !newSlideIsHidden) {
                oldSlide.classList.remove('currentSlide')
            } else {
                // Keep class as a hint, what was the last slide
            }
        }

        // Do not scroll to a slide whos group is not visible
        if (newSlide && !newSlideIsHidden) {
            newSlide.classList.add('currentSlide')
            newSlide.parentElement.classList.add('currentGroup')
            scrollToCurrentSlide(animate)

            // Yes sometimes it just does not scroll...
            // Try again
            setTimeout(function () {
                scrollToCurrentSlide(animate)
            }, 32)
        }
    }

    function scrollToCurrentSlide(animate = true) {
        const slide = presentationContainerElement.querySelector('.currentSlide')
        if (!slide) {
            return
        }

        const presentationContainerHeight = presentationContainerElement.clientHeight
        const isFirstSlideInGroup = slide.parentElement.querySelector('.slide') === slide

        let slideBoundingRect = slide.getBoundingClientRect()

        let deltaY = undefined
        if (isFirstSlideInGroup || slide.parentElement.scrollHeight < (presentationContainerHeight * 0.9)) {
            // Just a small offfset to make it look good
            const smallOffset = parseFloat(getComputedStyle(document.body).fontSize) * 0.5
            // Whole group is fits in screen or this is the first slide
            deltaY = slide.parentElement.getBoundingClientRect().top - smallOffset
        } else {
            deltaY = slideBoundingRect.top - presentationContainerHeight * 0.2
        }

        if (slideBoundingRect.top >= 0 && slideBoundingRect.bottom <= presentationContainerHeight) {
            const duration = Math.abs(deltaY) * 2
            scroller.scroll(0 | deltaY, duration)
        } else {
            scroller.scroll(0 | deltaY, 200)
        }
    }

    return {
        displayPresentation: displayPresentation,
        insertGroupToPresentation: insertGroupToPresentation,
        changeCurrentSlideAndScroll: changeCurrentSlideAndScroll
    }
}
