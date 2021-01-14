"use strict"

function PresentationDomUpdater() {
    const nextUpContainerElement = document.getElementById('nextUpContainer')
    const nextUpElement = document.getElementById('nextUp')
    const presentationContainerElement = document.getElementById('presentationContainer')
    const scroller = Scroller(presentationContainerElement)
    const titleElement = presentationContainerElement.querySelector('#title')
    const slideElements = presentationContainerElement.getElementsByClassName('slide')
    const groupElements = presentationContainerElement.getElementsByClassName('group')

    if (ResizeObserver) {
        new ResizeObserver(entries => {
           // Wrap in requestAnimationFrame to avoid "ResizeObserver loop limit exceeded"
           requestAnimationFrame(() => {
             if (!Array.isArray(entries) || !entries.length) {
               return;
             }
             onresize()
           });
        }).observe(presentationContainerElement)
    } else {
        window.onresize = onresize
    }
    window.addEventListener('styleChanged', onresize)

    let issueScrollTimeout = undefined
    function onresize() {
        clearTimeout(issueScrollTimeout)
        fixGroupNameElementPosition()
        fixSlidesTextSize()
        issueScrollTimeout = setTimeout(scrollToCurrentSlide, 500)
    }

    function displayPresentation(presentation, slideIndex, animate) {
        if (animate) {
            presentationContainerElement.style.opacity = 0
            nextUpContainerElement.style.display = 'none'
            setTimeout(() => {
                display()
                presentationContainerElement.style.opacity = 1
                presentationContainerElement.scrollTop = 0
                setTimeout(() => {
                    changeCurrentSlideAndScroll(slideIndex, true)
                }, 150)
            }, 300)
        } else {
            nextUpContainerElement.style.display = 'none'
            display()
            presentationContainerElement.scrollTop = 0
            changeCurrentSlideAndScroll(slideIndex, false)
        }

        function display() {
            while(groupElements.length > 0) {
                groupElements[0].remove();
            }

            // Update elements
            titleElement.innerHTML = presentation.name
            titleElement.style.display = presentation.name ? 'block' : 'none'

            // Insert new elements
            for (const group of presentation.groups) {
                const groupElement = buildGroupElement(group)
                presentationContainerElement.append(groupElement)
            }

            if(presentation.groups.length > 0) {
                // TODO: Also update this if new group inserted at index 0
                // Hide the first group if it only contains empty slides
                const firstGroupSlides = presentation.groups[0].slides
                if (!firstGroupSlides || !firstGroupSlides.every(s => s.lines.some(l => l.length > 0))) {
                    groupElements[0].style.display = 'none'
                }
            }

            fixGroupNameElementPosition()
            fixSlidesTextSize()
        }
    }

    function setNextPresentationTitle(nextTitle) {
        if(nextTitle && nextTitle.length > 0) {
            if (nextTitle.length > 27) {
                nextTitle = nextTitle.substring(0, 24) + '...'
            }
            nextUpElement.innerText = nextTitle
        } else {
            nextUpElement.innerText = ''
            nextUpContainerElement.style.display = 'none'
        }
    }

    function insertGroupToPresentation(group, index = 0) {
        const groupElement = buildGroupElement(group)
        const insertedBeforeCurrent = index <= getCurrentSlideIndex()

        if (index < groupElements.length) {
            const elementBefore = groupElements[index]
            presentationContainerElement.insertBefore(groupElement, elementBefore)
        } else {
            presentationContainerElement.appendChild(groupElement)
        }

        fixGroupNameElementPosition()
        fixSlidesTextSize()
        if (insertedBeforeCurrent) {
            scrollToCurrentSlide(false)
        }
    }

    function fixGroupNameElementPosition() {
        for (const groupElement of groupElements) {
            const groupNameElement = groupElement.querySelector('.groupName')
            groupNameElement.style.position = 'absolute'

            const firstLine = groupElement.querySelector('.line')
            const groupNameOffsetRight = groupNameElement.offsetLeft + groupNameElement.offsetWidth
            if (firstLine && firstLine.offsetLeft <= groupNameOffsetRight) {
                groupNameElement.style.position = ''
            }
        }
    }

    function fixSlidesTextSize() {
        const presentationContainerElementHeight = presentationContainerElement.clientHeight

        const nextUpContainerElementStyleDisplay = nextUpContainer.style.display
        nextUpContainer.style.display = 'block'
        for (const groupElement of groupElements) {
            const groupNameElement = groupElement.querySelector('.groupName')

            const slideElements = groupElement.querySelectorAll('.slide')
            for (let i = 0; i < slideElements.length; i++) {
                let maxHeight = presentationContainerElementHeight
                if (i === 0) {
                    maxHeight -= groupNameElement.scrollHeight + 6
                }
                if (i === slideElements.length - 1) {
                    maxHeight -= nextUpContainerElement.scrollHeight + 6
                }

                slideElements[i].style.fontSize = '1em'
                fontSizeReducer(slideElements[i], maxHeight)
            }
        }
        nextUpContainer.style.display = nextUpContainerElementStyleDisplay
    }

    function buildGroupElement(group) {
        const groupElement = document.createElement('section')
        groupElement.classList.add('group')
        groupElement.style.borderColor = group.color

        const groupNameElement = document.createElement('div')
        groupNameElement.classList.add('groupName')
        groupNameElement.innerText = group.name
        groupNameElement.style.color = group.color
        groupElement.appendChild(groupNameElement)

        if (group.hasLongTextLines) {
            groupElement.classList.add('groupWithLongText')
        }
        for (const slide of group.slides) {
            const slideElement = document.createElement('div')
            slideElement.classList.add('slide')

            if (slide.isBiblePassage) {
                slideElement.classList.add('biblePassage')
            }
            for (let i = 0; i < slide.lines.length; i++) {
                const line = slide.lines[i]

                const lineSpan = document.createElement('span')
                lineSpan.classList.add('line')

                const bibleVerseNumber = (slide.bibleVerseNumbers || [])[i]
                if (bibleVerseNumber && bibleVerseNumber.length > 0){
                    const bibleVerseSpan = document.createElement('span')
                    bibleVerseSpan.innerText = bibleVerseNumber
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
        const currentSlide = presentationContainerElement.querySelector('.currentSlide')
        return Array.prototype.indexOf.call(slideElements, currentSlide)
    }

    function changeCurrentSlideAndScroll(slideIndex, animate = true) {
        if (!slideElements || slideElements.length === 0) {
            if (nextUpElement.innerText.length > 0) {
                nextUpContainerElement.style.display = 'inherit'
            }
            return
        }

        const oldSlide = presentationContainerElement.querySelector('.currentSlide')
        const newSlide = slideElements[Math.min(slideIndex, slideElements.length -1)]
        const newGroup = newSlide ? newSlide.parentElement : undefined
        const newSlideGroupIsNotDisplayed = newGroup && newGroup.style.display === 'none'

        if (oldSlide) {
            oldSlide.parentNode.classList.remove('currentGroup')
            if (newSlide && !newSlideGroupIsNotDisplayed) {
                oldSlide.classList.remove('currentSlide')
            } else {
                // Keep class as a hint, what was the last slide
            }
        }

        // Do not scroll to a slide whos group is not visible
        if (newSlide && !newSlideGroupIsNotDisplayed) {
            newSlide.classList.add('currentSlide')
            newSlide.parentElement.classList.add('currentGroup')

            scrollToCurrentSlide(animate)
        }

        if (nextUpElement.innerText.length > 0) {
            const slide = newSlide ? newSlide : oldSlide
            const lastSlide = slideElements[slideElements.length - 1]
            const isLastSlide = slide === lastSlide

            const lastGroup = groupElements[groupElements.length -1]
            const isLastGroupAndNotEmpty = slide && lastGroup === slide.parentElement &&
                !lastGroup.classList.contains('emptyGroup')
            const showNextUp = isLastSlide || isLastGroupAndNotEmpty
            nextUpContainerElement.style.display = showNextUp ? 'inherit' : 'none'
        } else {
            nextUpContainerElement.style.display = 'none'
        }
    }

    function scrollToCurrentSlide(animate = true) {
        if (Array.prototype.every.call(groupElements, g => g.classList.contains('emptyGroup'))) {
            // Only empty groups that are not visible, do not scroll
            return
        }
        const slide = presentationContainerElement.querySelector('.currentSlide')
        if (!slide) {
            return
        }

        const presentationContainerElementHeight = presentationContainerElement.clientHeight
        const isFirstSlideInGroup = slide.parentElement.querySelector('.slide') === slide

        const slideBoundingRect = slide.getBoundingClientRect()
        let deltaY = undefined
        if (isFirstSlideInGroup || slide.parentElement.offsetHeight < (presentationContainerElementHeight * 0.9)) {
            // Just a small offfset to make it look good
            // Whole group is fits in screen or this is the first slide
            deltaY = slide.parentElement.getBoundingClientRect().top
        } else if (slide.offsetHeight < presentationContainerElementHeight * 0.6) {
            deltaY = slideBoundingRect.top - presentationContainerElementHeight * 0.2
        } else {
            deltaY = slideBoundingRect.top
        }

        if (animate) {
            if (slideBoundingRect.top >= 0 && slideBoundingRect.bottom <= presentationContainerElementHeight) {
                const duration = Math.abs(deltaY) * 2
                scroller.scroll(0 | deltaY, duration)
            } else {
                scroller.scroll(0 | deltaY, 200)
            }
        } else {
            presentationContainerElement.scrollTop += deltaY
        }
    }

    return {
        displayPresentation: displayPresentation,
        setNextPresentationTitle: setNextPresentationTitle,
        clearNextPresentationTitle: () => setNextPresentationTitle(undefined),
        insertGroupToPresentation: insertGroupToPresentation,
        changeCurrentSlideAndScroll: changeCurrentSlideAndScroll
    }
}
