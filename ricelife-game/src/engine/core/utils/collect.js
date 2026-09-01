/*
 * iteratbles should be an array of iterables. Not actual iterators
 */
export function* zip (iterables) {
    const iters = iterables.map((iter) => iter[Symbol.iterator]());
    try {
        while (true) {
            const next = iters.map((it) => it.next());
            if (next.some(({done}) => done)) break;
            yield next.map(({value}) => value);
        }
    } finally {
        for (const it of iters) {
            if (typeof it.return === 'function') {
                it.return();
            }
        }
    }
}