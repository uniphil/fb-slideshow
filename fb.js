(fb => {
  function fbP(/*arguments*/) {
    return new Promise((resolve, reject) => {
      const fbArgs = Array.prototype
        .slice.apply(arguments)
        .concat([result => result.error ?
          reject(new Error(result.error.message)) :
          resolve(result)
        ]);
      FB.api.apply(FB, fbArgs)
    });
  }

  const promiseFacebookLogin = scope => new Promise((resolve, reject) =>
    FB.login(response => {
      if (response.status === 'connected') {
        return resolve(response.authResponse);
      } else {
        return reject(new Error('did not log in >:'));
      }
    }, { scope }));


  Object.assign(fb, {
    fbP,
    promiseFacebookLogin,
  });

})(window.fb = {});
