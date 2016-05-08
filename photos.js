((c, Immutable, Union, Async, fb, d, t) => {

  const Actions = Union({
    LoadPhotos: null,
    Next: null,
  });

  const State = Immutable.Record({
    photos: null,
    selected: 0,
  });

  const init = () => ({
    state: State({
      photos: Async.Pending(),
    }),
    effects: [{
      start: () => fb.fbP('/10153487730616316/photos', {
        fields: [ 'images' ],
        limit: 200,
      }),
      wrap: Actions.LoadPhotos,
    }],
  });

  const update = (state, action) => Actions.match(action, {
    LoadPhotos: result => ({
      effects: [],
      state: state.set('photos', result.andThen(stuff => stuff.data)),
    }),
    Next: () => ({
      effects: [],
      state: state.update('selected', n =>
        Async.match(state.get('photos'), {
          Done: photos => (n + 1) % photos.length,
          _: () => n
        })),
    }),
  });


  const View = (state, dispatch) =>
    Async.match(state.get('photos'), {
      Pending: () => d('p', {}, [t('Loading photos...')]),
      Errored: () => d('p', {}, [t('Error loading photos >:')]),
      Done: photos => d('div', { attrs: { style: {
        backgroundColor: '#000',
        backgroundImage: `url(${photos[state.get('selected')].images[0].source})`,
        backgroundPosition: '50%',
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'contain',
        height: '100%',
        width: '100%',
      } }, events: {
        click: () => dispatch(Actions.Next()),
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
,  window.fb
,  window.d
,  window.t
);
