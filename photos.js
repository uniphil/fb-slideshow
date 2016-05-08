((c, Immutable, Union, Async, Effect, fb, d, t) => {

  const SHOWTIME = 4000;
  const TRANSTIME = 1000;

  const SPACE = 32;
  const LEFT = 37;
  const RIGHT = 39;

  const Actions = Union({
    LoadPhotos: null,
    KeyDown: null,
    StartAutoplay: null,
    Tick: null,
  });

  const Commands = Union({
    Back: null,
    Forward: null,
    TogglePlayPause: null,
  });

  const State = Immutable.Record({
    loadState: Async.Pending(),
    photos: Immutable.List(),
    playing: false,
    commands: Immutable.List(),
    selected: 0,
    trans: 0,
    t0: 0,
  });

  const getNext = state => {
    const current = state.get('selected');
    const total = state.get('photos').size;
    if (total > 0) {
      return (current + 1) % total;
    } else {
      return current;
    }
  };

  const getPrev = state => {
    const current = state.get('selected');
    const total = state.get('photos').size;
    if (total > 0) {
      return (current + total - 1) % total;
    } else {
      return current;
    }
  };

  const init = () => ({
    state: State(),
    effects: [{
      effect: Effect.Task(() => fb.fbP('/10153487730616316/photos', {
        fields: [ 'images' ],
        limit: 200,
      })),
      wrap: Actions.LoadPhotos,
    }, {
      effect: Effect.Listen('keydown'),
      wrap: Actions.KeyDown,
    }],
  });

  const update = (state, action) => Actions.match(action, {
    LoadPhotos: result => Async.match(result, {
      _: () => ({
        effects: [{
          effect: Effect.Tick(),
          wrap: Actions.StartAutoplay,
        }],
        state: state.set('loadState', result),
      }),
      Done: data => ({
        effects: [],
        state: state
          .set('loadState', Async.Done())
          .set('playing', true)
          .update('photos', photos =>
            photos.concat(data.data.map(photo =>
              photo.images[0].source))),
      }),
    }),

    KeyDown: e => {
      let nextState = state,
          command;
      if (e.keyCode === LEFT) {
        command = Commands.Back();
      } else if (e.keyCode === RIGHT) {
        command = Commands.Forward();
      } else if (e.keyCode === SPACE) {
        command = Commands.TogglePlayPause();
      }
      if (command) {
        nextState = nextState.update('commands', c => c.push(command));
      }
      return {
        effects: [{
          effect: Effect.Tick(),
          wrap: Actions.Tick,
        }],
        state: nextState,
      };
    },

    StartAutoplay: t0 => ({
      effects: [{
        effect: Effect.Tick(),
        wrap: Actions.Tick,
      }],
      state: state.merge({
        t0: t0,
        playing: true,
      }),
    }),

    Tick: t => {
      let nextState = state;

      nextState.get('commands').forEach(command =>
        nextState = Commands.match(command, {
          Back: () =>
            nextState.merge({
              selected: getPrev(nextState),
              trans: 0,
              t0: t,
            }),
          Forward: () =>
            nextState.merge({
              selected: getNext(nextState),
              trans: 0,
              t0: t,
            }),
          TogglePlayPause: () =>
            nextState.merge({
              playing: !nextState.get('playing'),
              t0: t - SHOWTIME,  // transition to the next thing
            }),
        }));
      nextState = nextState.set('commands', Immutable.List());

      if (nextState.get('playing')) {
        const dt = t - nextState.get('t0');
        if (SHOWTIME <= dt && dt < (SHOWTIME + TRANSTIME)) {
          nextState = nextState
            .set('trans', (dt - SHOWTIME) / TRANSTIME);
        } else if (dt >= (SHOWTIME + TRANSTIME)) {
          nextState = nextState.merge({
            selected: getNext(nextState),
            trans: 0,
            t0: t,
          });
        }
      }

      return {
        effects: nextState.get('playing')
          ? [{
            effect: Effect.Tick(),
            wrap: Actions.Tick,
          }]
          : [],
        state: nextState,
      };
    },
  });


  const imStyle = {
    backgroundPosition: '50%',
    backgroundRepeat: 'no-repeat',
    backgroundSize: 'contain',
    height: '100%',
    left: '0',
    position: 'absolute',
    top: '0',
    width: '100%',
  };


  const View = (state, dispatch) =>
    Async.match(state.get('loadState'), {
      Pending: () => d('p', {}, [t('Loading photos...')]),
      Errored: () => d('p', {}, [t('Error loading photos >:')]),
      Done: () => d('div', {}, [
        d('div', { attrs: { style: o.merge(imStyle, {  // preloader
          backgroundImage: `url(${state.getIn(['photos', getNext(state)])})`,
          opacity: `${Math.max(0, state.get('trans') - (1 / 3)) * (3 / 2)}`,
          zIndex: `${state.get('trans') > 0 ? '1' : '0'}`,
        }) } }, []),
        d('div', { attrs: { style: o.merge(imStyle, {
          backgroundImage: `url(${state.getIn(['photos', state.get('selected')])})`,
          opacity: `${1 - state.get('trans')}`,
        }) } }, []),
      ]),
    });

  Object.assign(c, {
    init,
    update,
    View,
  });
})((window.components || (window.components = {})).photos = {}
,  window.Immutable
,  window.Union
,  window.Async
,  window.Effect
,  window.fb
,  window.d
,  window.t
);
