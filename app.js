'use strict';

((module, Immutable, Async, Effect, fb, components, u, d, t) => {

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
              effects: u.wrap(photosInit.effects, Actions.PhotosAction),
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
          effect: Effect.Task(() => fb.promiseFacebookLogin(['user_photos'])),
          wrap: Actions.Login,
        }],
      }),
      PhotosAction: u.forward(state, 'photosState', Actions.PhotosAction, components.photos.update),
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
, window.Effect
, window.fb
, window.components
, window.u
, window.d
, window.t
);
