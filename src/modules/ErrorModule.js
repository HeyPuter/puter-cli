const ERROR_BUFFER_LIMIT = 20;

const errors = [];

export const report = (error) => {
  errors.push(error);
  if (errors.length > ERROR_BUFFER_LIMIT) {
    errors = errors.slice(errors.length - ERROR_BUFFER_LIMIT);
  }
}
export const showLast = () => {
  // Print the last error from the error history,
  // and remove it from the history
  const err = errors.pop();
  if (err) {
    console.error(err);
  } else {
    console.log('No errors to report');
  }
}