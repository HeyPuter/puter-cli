/**
 * Ideally we would always get a context from the caller, but in some places
 * this is not possible without creating a large number of changes
 * (and therefore also a large number of new bugs). This temporary file
 * provides a way to get the context that modules get.
 */

let context;

// This is called by (list all callers so we can keep track):
// - auth.js:getAuthToken
export const get_context = () => {
    return context;
};

// This is called by SetContextModule
export const set_context = ctx => context = ctx;
