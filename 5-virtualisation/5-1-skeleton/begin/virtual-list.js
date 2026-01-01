import { intersectionObserver } from "../../../utils/observer.js";

/**
 * Standard Margin between cards
 * @type {number}
 */
const MARGIN = 16;

/**
 * Returns top and bottom observer elements
 * @returns {[HTMLElement,HTMLElement]}
 */
const getObservers = () => [
  document.getElementById("top-observer"),
  document.getElementById("bottom-observer"),
];

/**
 * Returns a virtual list container
 * @returns {HTMLElement}
 */
function getVirtualList() {
  return document.getElementById("virtual-list");
}

/**
 * Returns a main app container
 * @returns {HTMLElement}
 */
function getContainer() {
  return document.getElementById("container");
}

/**
 * Returns `data-y` attribute of the HTMLElement, if value is provided
 * additionally updates the attribute
 *
 * @param element {HTMLElement}
 * @param value {string | number}
 * @returns {?number}
 */
function y(element, value = undefined) {
  if (value != null) {
    element?.setAttribute("data-y", value);
  }
  const y = element?.getAttribute("data-y");
  if (y !== "" && y != null && +y === +y) {
    return +y;
  }
  return null;
}

/**
 * Returns a CSS Transform Style string to Move Element by certain amount of pixels
 * @param value      - value in pixels
 * @returns {string}
 */
function translateY(value) {
  return `translateY(${value}px)`;
}

/**
 * Starter skeleton
 */
export class VirtualList {
  /**
   * @param root
   * @param props {{
   *     getPage: <T>(p: number) => Promise<T[]>,
   *     getTemplate: <T>(datum: T) => HTMLElement,
   *     updateTemplate: <T>(datum: T, element: HTMLElement) => HTMLElement,
   *     pageSize: number
   * }}
   */
  constructor(root, props) {
    this.props = { ...props };
    this.root = root;
    this.start = 0;
    this.end = 0;
    this.limit = props.pageSize * 2;
    this.pool = [];
  }

  /**
   * Returns an HTML Representation of the component, should have the following structure:
   * #container>
   *    #top-observer+
   *    #virtual-list+
   *    #bottom-observer
   * @returns {string}
   */
  toHTML() {
    /**
     * Part 1 - App Skeleton
     *  @todo
     */

    return `        
        <div id="container">
            <div id="top-observer">top Observer</div>
            <div id="virtual-list"></div>
            <div id="bottom-observer">bottom Observer</div>
        </div>`.trim();
  }

  /**
   * @returns void
   */
  #effect() {
    intersectionObserver(
      getObservers(),
      (entries) => this.#handleIntersectionObserver(entries),
      { threshold: 0.2 }
    );
  }

  /**
   * @returns void
   */
  render() {
    this.root.innerHTML = this.toHTML();
    this.#effect();
  }

  /**
   * Handles observer intersection entries
   * @param entries {IntersectionObserverEntry[]}
   */
  #handleIntersectionObserver(entries) {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        if (entry.target.id === "bottom-observer") {
          this.#handleBottomObserver();
        } else if (entry.target.id === "top-observer" && this.start > 0) {
          this.#handleTopObserver();
        }
      }
    }
  }

  /**
   * Handles the intersection observer event triggered when the bottom of the virtual list becomes visible.
   * This method scrolls the virtual list downward by loading the next page of data.
   *
   * @async
   * @private
   * @returns {Promise<void>}
   *
   * @description
   * 1. Fetches the next page of data using the current end index
   * 2. If pool size is below limit, creates new DOM elements and appends them
   * 3. If pool is at capacity, recycles elements by reordering and updating with new data
   * 4. Increments start pointer when pool reaches capacity
   * 5. Updates the vertical positions of all elements to reflect the downward scroll
   */
  async #handleBottomObserver() {
    const data = await this.props.getPage(this.end++);
    const list = getVirtualList();
    const container = getContainer();
    if (this.pool.length < this.limit) {
      const fragment = document.createDocumentFragment();
      for (const datum of data) {
        const cardElement = this.props.getTemplate(datum);
        fragment.appendChild(cardElement);
        this.pool.push(cardElement);
      }
      list.appendChild(fragment);
    } else {
      //think in terms of references
      const [recycle, unchanged] = [
        this.pool.slice(0, this.props.pageSize),
        this.pool.slice(this.props.pageSize),
      ];
      this.pool = unchanged.concat(recycle);
      this.#updateData(recycle, data);
      this.start++;
    }
    container.style.height = `${container.scrollHeight}px`;
    this.#updateElementsPosition("down");
  }

  /**
   * Handles the intersection observer event triggered when the top of the virtual list becomes visible.
   * This method scrolls the virtual list upward by loading the previous page of data.
   *
   * @async
   * @private
   * @returns {Promise<void>}
   *
   * @description
   * 1. Decrements the start and end indices by 1 to shift the viewport upward
   * 2. Fetches the previous page of data using the new start index
   * 3. Splits the current pool of htmlelements into two parts: unchanged (first pageSize items) and toRecycle (remaining items)
   * 4. Reconstructs the pool by concatenating toRecycle items with unchanged items
   * 5. Updates the recycled DOM elements with the newly fetched data
   * 6. Adjusts the vertical positions of all elements to reflect the upward scroll
   */
  async #handleTopObserver() {
    this.start = this.start - 1;
    this.end = this.end - 1;
    const data = await this.props.getPage(this.start);
    const [unchanged, toRecycle] = [
      this.pool.slice(0, this.props.pageSize),
      this.pool.slice(this.props.pageSize),
    ];
    this.pool = toRecycle.concat(unchanged);
    this.#updateData(toRecycle, data);
    this.#updateElementsPosition("top");
  }

  /**
   * Function uses `props.getTemplate` to update the html elements
   * using provided data
   *
   * @param elements {HTMLElement[]} - HTML Elements to update
   * @param data {T[]} - Data to use for update
   */
  #updateData(elements, data) {
    for (let i = 0; i < data.length; i++) {
      this.props.updateTemplate(data[i], elements[i]);
    }
  }

  /**
   * Move elements on the screen using CSS Transform
   *
   * @param direction {"top" | "down" }
   */
  #updateElementsPosition(direction) {
    const [top, bottom] = getObservers();
    /*for bottom observer*/
    if (direction === "down") {
      for (let i = 0; i < this.pool.length; i++) {
        const prev = this.pool.at(i - 1);
        const current = this.pool[i];
        /**that mean the data-y attribute is not set and we set it to 0 based on prev element*/
        if (y(prev) == null) {
          y(current, 0);
        } else {
          /**data-y attribute is already set calculating the new data-y position  for curr html element using prev html element and margin */
          const newY =
            y(prev) + MARGIN * 2 + prev.getBoundingClientRect().height;
          y(current, newY);
          /***using css transform transformY to set the position */
          current.style.transform = translateY(newY);
        }
      }
    } else if (direction === "top") {
      // To implement
      for (let i = this.props.pageSize - 1; i >= 0; i--) {
        const current = this.pool[i];
        const next = this.pool[i + 1];
        const newYpos =
          y(next) - MARGIN * 2 - current.getBoundingClientRect().height;
        y(current, newYpos);
        current.style.transform = translateY(newYpos);
      }
    }
    const firstElement = this.pool[0];
    const lastElement = this.pool.at(-1);
    /**updating the top and bottom observer position */
    const topYPos = y(firstElement);
    const bottomYPos =
      y(lastElement) + lastElement.getBoundingClientRect().height + MARGIN * 2;
    top.style.transform = translateY(topYPos);
    bottom.style.transform = translateY(bottomYPos);
  }
}
