((c, Immutable, Union, Async, Effect, fb, d, t) => {

  const Actions = Union({
    LoadPhotos: null,
    StartAutoplay: null,
    Tick: null,
  });

  const State = Immutable.Record({
    loadState: Async.Pending(),
    photos: Immutable.List(),
    selected: 0,
    t0: 0,
  });

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
        effects: [],
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
    Tick: t => ({
      effects: [{
        effect: Effect.Tick(),
        wrap: Actions.Tick,
      }],
      state: (t - state.get('t0')) < 2000
        ? state
        : state
          .set('t0', t)
          .update('selected', n => {
            const total = state.get('photos').size;
            if (total > 0) {
              return (n + 1) % total;
            } else {
              return n;
            }
          }),
    }),
  });


  const View = (state, dispatch) =>
    Async.match(state.get('loadState'), {
      Pending: () => d('p', {}, [t('Loading photos...')]),
      Errored: () => d('p', {}, [t('Error loading photos >:')]),
      Done: () => d('div', { attrs: { style: {
        backgroundColor: '#000',
        backgroundImage: `url(${state.getIn(['photos', state.get('selected')])})`,
        backgroundPosition: '50%',
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'contain',
        height: '100%',
        width: '100%',
      } }, events: {
        click: () => dispatch(Actions.StartAutoplay()),
      } }, []),
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
