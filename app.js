'use strict';

((module, Immutable, Async, fb, components, d, t) => {

  const ALBUM_ID = '10153487730616316';

  const Actions = Union({
    Login: null,
    StartLogin: null,
    PhotosAction: null,
  });

  const State = Immutable.Record({
    user: null,
    photosState: null,
  });

  const App = {
    init: () => ({
      effects: [],
      state: State({
        user: Async.Errored(new Error('not started')),
        photosState: null,
      }),
    }),

    update: (state, action) => Actions.match(action, {
      Login: result =>
        Async.match(result, {
          Done: user => {
            const photosInit = components.photos.init();
            return {
              effects: photosInit.effects.map(effect => ({
                start: effect.start,
                wrap: payload => Actions.PhotosAction(effect.wrap(payload)),
              })),
              state: state.merge({
                user: result,
                photosState: photosInit.state,
              }),
            };
          },
          _: () => ({
            effects: [],
            state: state.set('user', result),
          }),
        }),
      StartLogin: () => ({
        state,
        effects: [{
          start: () => fb.promiseFacebookLogin(['user_photos']),
          wrap: Actions.Login,
        }],
      }),
      PhotosAction: action => {
        const updated = components.photos.update(state.get('photosState'), action);
        return {
          effects: updated.effects.map(effect => ({
            start: effect.start,
            wrap: payload => Actions.PhotosAction(effect.wrap(payload)),
          })),
          state: state.set('photosState', updated.state),
        };
      },
    }),

    View: (state, dispatch) =>
      Async.match(state.get('user'), {
        Pending: () =>
          d('p', {}, [t('checking login…')]),
        Errored: () =>
          d('p', {}, [
            d('button', { events: {
              click: () => dispatch(Actions.StartLogin()),
            } }, [t('log in')]),
          ]),
        Done: () =>
          components.photos.View(state.get('photosState'),
            payload => dispatch(Actions.PhotosAction(payload))),
      }),
  };

  render(App, document.getElementById('app'));
})({}
, window.Immutable
, window.Async
, window.fb
, window.components
, window.d
, window.t
);
