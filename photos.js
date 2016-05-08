((c, Immutable, Union, Async, Effect, fb, d, t) => {

  const SHOWTIME = 4000;
  const TRANSTIME = 1000;

  const Actions = Union({
    LoadPhotos: null,
    StartAutoplay: null,
    Tick: null,
  });

  const State = Immutable.Record({
    loadState: Async.Pending(),
    photos: Immutable.List(),
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

  const init = () => ({
    state: State(),
    effects: [{
      effect: Effect.Task(() => fb.fbP('/10153487730616316/photos', {
        fields: [ 'images' ],
        limit: 200,
      })),
      wrap: Actions.LoadPhotos,
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
          .update('photos', photos =>
            photos.concat(data.data.map(photo =>
              photo.images[0].source))),
      }),
    }),
    StartAutoplay: t0 => ({
      effects: [{
        effect: Effect.Tick(),
        wrap: Actions.Tick,
      }],
      state: state.set('t0', t0),
    }),
    Tick: t => {
      const dt = t - state.get('t0');
      let nextState = state;
      if (SHOWTIME <= dt && dt < (SHOWTIME + TRANSTIME)) {
        nextState = state
          .set('trans', (dt - SHOWTIME) / TRANSTIME);
      } else if (dt >= (SHOWTIME + TRANSTIME)) {
        nextState = state.merge({
          selected: getNext(state),
          trans: 0,
          t0: t,
        });
      }
      return {
        effects: [{
          effect: Effect.Tick(),
          wrap: Actions.Tick,
        }],
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
      Done: () => d('div', { attrs: { style: {
        backgroundColor: '#000',
        height: '100%',
        position: 'relative',
        width: '100%',
      } }, events: {
        click: () => dispatch(Actions.StartAutoplay()),
      } }, [
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
