/* Navigation bridge. app.js fills these in at init; views call them.
   Kept in its own module so views.js and app.js don't import each other. */
export const nav = {
  go(/* route */) {},
  replace(/* route */) {},
  back() {},
  rerender() {},
  current() { return { view: 'wardrobe' }; },
};
