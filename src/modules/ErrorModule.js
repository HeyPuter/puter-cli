const ERROR_BUFFER_LIMIT = 20;

export const ErrorAPI = Symbol('ErrorAPI');

export default ({ context }) => {
    // State Variables
    const errors = [];

    context.events.on('error', (error) => {
        context[ErrorAPI].report(error);
    });

    // Module Methods
    context[ErrorAPI] = {
        // Add an error to the error history
        report (error) {
            errors.push(error);
            if (errors.length > ERROR_BUFFER_LIMIT) {
                errors = errors.slice(errors.length - ERROR_BUFFER_LIMIT);
            }
        },
        // Print the last error from the error history,
        // and remove it from the history
        showLast () {
            const err = errors.pop();
            if (err) {
                console.error(err);
            } else {
                console.log('No errors to report');
            }
        }
    };
};
