'use strict';

/**
 * d args:
 * @param {string} name the tagName of the DOM node to make a factory for
 * Returned function args:
 * @param {object} props An object with all events and attributes to set on
 * @param {object} props.attrs Attributes to set with Element.setAttribute(),
 *   though note that `value` is special is directly assigned to the element
 * @param {object} props.events Event handler functions to attach
 * @param {object[]} children children to appendChild on this element, as
 *   Virtual DOM nodes like those returned by this function
 * @returns {object} A Virtual DOM node specifying this node
 */
window.d = (name, props, children) => {
  // it's easy to forget an empty {} if no props are needed
  if (props && Array.isArray(props)) {
    throw new Error(`Expected an Object for props but found an Array: '${JSON.stringify(props)}'\nDid you forget to put an empty '{}' for props before the child array?`);
  }
  // props only has two valid keys, so catch any typos here
  if (props && Object.keys(props).some(k => ['events', 'attrs'].indexOf(k) === -1)) {
    throw new Error(`Invalid key found in props {${Object.keys(props).join(': ..., ')}: ...} for DOMNode '${name}'\nOnly 'attrs' and 'events' are allowed -- did you forget to nest your attribute or event inside one of those?`);
  }
  // single children (even text nodes) still need to be wrapped in an array, but I mess this up constantly
  if (children && !Array.isArray(children)) {
    throw new Error(`Expected an Array for children but found ${JSON.stringify(children)}. Did you forget to wrap a single child in an array?`);
  }
  return {
    type: 'DOMNode',
    tagName: name.toUpperCase(),
    events: props && props.events || {},
    attrs: props && props.attrs || {},
    children: children || [],
  };
};

/**
 * Text node factory
 * @param {string} content The content of the TextNode
 * @returns {object} A Virtual DOM text node
 */
window.t = content => ({ type: 'TextNode', content });

const ar = {
  flatMap(arr, fn) {
    return arr
      .map(el => fn(el))
      .reduce((acc, el) => acc.concat(el), []);
  },
  setAt(arr, i, v) {
    const copy = arr.slice();
    copy[i] = v;
    return copy;
  },
};

const o = {
  filterValues(obj, fn) {
    const out = {};
    Object.keys(obj).forEach(k => {
      if (fn(obj[k])) {
        out[k] = obj[k];
      }
    });
    return out;
  },
  merge(obj, toMerge) {
    return Object.assign({}, obj, toMerge);
  },
  set(obj, key, val) {
    return o.merge(obj, { [key]: val });
  },
  del(obj, key) {
    const o = Object.assign({}, obj);
    delete o[key];
    return o;
  }
};

window.u = {
  wrap: (effects, wrapper) =>
    effects.map(effect => ({
      effect: effect.effect,
      wrap: payload => wrapper(effect.wrap(payload))
    })),
  forward: (state, k, wrapper, update) => action => {
    const updated = update(state.get(k), action);
    return {
      state: state.set(k, updated.state),
      effects: window.u.wrap(updated.effects, wrapper),
    };
  },
};

window.Async = Union({
  Done: null,
  Pending: null,
  Errored: null,
}, {
  andThen: function(fn) {
    return window.Async.match(this, {
      Done: p => window.Async.Done(fn(p)),
      _: () => this,
    });
  },
});

window.Effect = Union({
  Listen: null,
  Task: null,
  Tick: null,
});

/**
 * The simplest (and worst) DOM updater I can come up with :)
 * Takes the brute-force approach of walking the whole DOM tree, remving all
 * attributes and events that were declared at the last render, and adding all
 * that were declared for this render. Yes, most of the time this will remove
 * and re-add exactly the same things. Do any browsers see ths and optimize it?
 * @param {DOMNode} el An actual real DOM node to update
 * @param {vDOMNode} vDOM the current (previous, stale) Virtual DOM spec
 * @param {vDOMNode} nextDOM the next VirtualDOM spec we want el to match when
 *   this function is done.
 * @returns {DOMNode} A ref to the updated DOMNode
 */
function updateDOM(el, vDOM, nextDOM) {
  // do nothing if we're rendering the same thing as last time :)
  if (nextDOM === vDOM) {
    // console.warn('skipping', vDOM);
    return el;
  }

  // Ensure our next vDOMNode is of a valid type
  if (!(nextDOM.type in { DOMNode:0, TextNode:0 })) {
    throw new Error(`Unknown vDOMNode.type for ${JSON.stringify(nextDOM)}`);
  }

  if (nextDOM.type === 'TextNode') {
    // replace the current node with a new textNode
    el.parentElement.replaceChild(document.createTextNode(nextDOM.content), el);
  } else {
    if (vDOM.type !== 'DOMNode' || ( vDOM.tagName !== nextDOM.tagName )) {
      // if we have a different kind of node, remove the old and empty vDOM's spec
      const nextEl = document.createElement(nextDOM.tagName);
      el.parentElement.replaceChild(nextEl, el);
      el = nextEl;
      vDOM = d(nextDOM.tagName, {}, []);
    }

    // brute-force remove/add all event listeners
    Object.keys(vDOM.events).forEach(evt => el.removeEventListener(evt, vDOM.events[evt]));
    Object.keys(nextDOM.events).forEach(evt => el.addEventListener(evt, nextDOM.events[evt]));
    // actually diff the attributes because otherwise there are weird side-effects in FF :(
    Object.keys(vDOM.attrs)
      .filter(attr => !(attr in nextDOM.attrs))
      .filter(attr => attr !== 'style')
      .forEach(attr => el.removeAttribute(attr));  // .value is a silent failure we can ignore
    Object.keys(nextDOM.attrs)
      .filter(attr => attr !== 'style')
      .filter(attr => attr !== 'value')
      .filter(attr => nextDOM.attrs[attr] !== vDOM.attrs[attr])
      .forEach(attr => el.setAttribute(attr, nextDOM.attrs[attr]));
    if (nextDOM.attrs.hasOwnProperty('value') &&
        nextDOM.attrs.value !== el.value) {
      el.value = nextDOM.attrs.value;
    }
    // brute-force reset all styles
    el.style.cssText = '';
    if (nextDOM.attrs.hasOwnProperty('style')) {
      Object.assign(el.style, nextDOM.attrs.style);
    }

    // Update children in place
    for (var i = 0; i < vDOM.children.length && i < nextDOM.children.length; i++) {
      updateDOM(el.childNodes[i], vDOM.children[i], nextDOM.children[i]);
    }
    // if there are new chlidren to add, add them
    for (var i = vDOM.children.length; i < nextDOM.children.length; i++) {
      const nextc = nextDOM.children[i];
      if (nextc.type === 'TextNode') {
        el.appendChild(document.createTextNode(nextc.content));
      } else if (nextc.type === 'DOMNode') {
        el.appendChild(document.createElement(nextc.tagName));
        updateDOM(el.lastChild, d(nextc.tagName, {}, []), nextc);
      } else {
        throw new Error(`Unknown node type for node: ${JSON.stringify(nextc)}`);
      }
    }
    // if there are extra children to remove, remove them
    for (var i = nextDOM.children.length; i < vDOM.children.length; i++) {
      el.removeChild(el.lastChild);
    }
  }
  return el;
}

function startEffects(effects, dispatch) {
  if (!effects) {
    throw new Error('Got falsy effects. Expected an empty array if no effects should be run.');
  }
  effects.length && console.info(`running ${effects.length} effects`);
  effects.forEach(effect => {
    window.Effect.match(effect.effect, {
      Listen: ev =>
        window.addEventListener(ev, e => dispatch(effect.wrap(e))),
      Tick: () =>
        requestAnimationFrame(t => dispatch(effect.wrap(t))),
      Task: start => {
        Promise.resolve().then(() => dispatch(effect.wrap(Async.Pending())));  // defer
        try {
          start(dispatch).then(
            result => dispatch(effect.wrap(Async.Done(result))),
            err => dispatch(effect.wrap(Async.Errored(err)))
          ).catch(err => {
            throw err;
          });
        } catch (err) {
          dispatch(effect.wrap(Async.Errored(err)));
        }
      }
    })
  });
}

function printAction(action) {
  if (!action) {
    throw new Error('Missing action', action);
  }
  const pl = action.payload;
  if (pl &&
      typeof pl.constructor === 'function' &&
      pl.constructor.unionFactory === Union) {
    const rec = printAction(pl);
    return {
      name: `${action.name}←${rec.name}`,
      payload: rec.payload,
    };
  } else if (pl &&
             typeof pl.key !== 'undefined' &&
             pl.action &&
             pl.action.payload &&
             typeof pl.action.payload.constructor === 'function' &&
             pl.action.payload.constructor.unionFactory === Union) {
    const rec = printAction(pl.action);
    return {
      name: `${action.name}←${pl.key}←${rec.name}`,
      payload: rec.payload,
    };
  } else {
    return action;
  }
}


function render(component, el) {
  var init,
      state,
      dispatching,  // guard against updaters trying to dispatch
      dirty = false,  // guard against queuing more RAFs when one is already queued
      vDOM = d(el.tagName, {}, []);  // dummy spec for the node we're attaching to

  /**
   * @param {Symbol|string} action? The action to dispatch (or undefined to force a render)
   * @returns {void}
   */
  function dispatch(action) {
    const printable = printAction(action);
    console.info(`←${printable.name}`, printable.payload);
    if (dispatching) {
      throw new Error(`'${action.toString()}' was dispatched while '${dispatching.toString()}' was still updating. Updaters should be pure functions and must not dispatch actions.`);
    }
    try {
      dispatching = action;
      const next = component.update(state, action);
      if (!Immutable.is(next.state, state)) {
        console.info('→', next.state.toJS ? next.state.toJS() : next.state);
      }
      startEffects(next.effects, dispatch);  // here so we can call it syncrhonously for trustedEvents for now
      state = next.state;
    } finally {
      dispatching = null;
    }
    updateUI();
  };


  /**
   * Queue a UI update if one isn't already queued
   * @returns {void}
   */
  function updateUI() {
    if (dirty) { return; }  // RAF already queued
    dirty = true;
    requestAnimationFrame(() => {
      try {
        el = updateDOM(el, vDOM, vDOM = component.View(state, dispatch));
      } finally {
        dirty = false;
      }
    });
  };

  // kick it off!
  init = component.init(window, dispatch);
  state = init.state;
  updateUI();
  startEffects(init.effects, dispatch)

  // give back a dispatch ref, so we can hook things up to make actions outside
  // of components
  return dispatch;
}
