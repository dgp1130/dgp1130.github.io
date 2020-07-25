import { promises as fs } from 'fs';
import process from 'process';

import { execFilter } from '../testing/filters';
import { aggregateStyles } from './styles';

describe('styles', () => {
    describe('aggregateStyles()', () => {
        it('aggregates multiple CSS files\' contents', async () => {
            spyOn(process, 'cwd').and.returnValue('/blog');
            spyOn(fs, 'readFile').and.returnValues(
                Promise.resolve(`.foo { color: red; }`),
                Promise.resolve(`.bar { color: blue; }`),
            );

            const styles = await execFilter(aggregateStyles, `
                styles/foo.css
                otherStyles/bar.css
            `);

            expect(fs.readFile).toHaveBeenCalledTimes(2);
            expect(fs.readFile).toHaveBeenCalledWith(
                '/blog/src/www/styles/foo.css',
                { encoding: 'utf8' },
            );
            expect(fs.readFile).toHaveBeenCalledWith(
                '/blog/src/www/otherStyles/bar.css',
                { encoding: 'utf8' },
            );

            expect(styles).toContain(`.foo { color: red; }`);
            expect(styles).toContain(`.bar { color: blue; }`);
        });

        it('deduplicates any duplicate CSS files\'', async () => {
            spyOn(process, 'cwd').and.returnValue('/blog');
            spyOn(fs, 'readFile').and.returnValue(
                Promise.resolve(`.foo { color: red; }`),
            );

            // `foo.css` is requested multiple times.
            const styles = await execFilter(aggregateStyles, `
                foo.css
                foo.css
            `);

            expect(fs.readFile).toHaveBeenCalledTimes(1);
            expect(fs.readFile).toHaveBeenCalledWith(
                '/blog/src/www/foo.css',
                { encoding: 'utf8' },
            );

            // Only one copy of `foo.css` should be present.
            expect(styles).toBe(`.foo { color: red; }`);
        });

        it('deduplicates any duplicate CSS file\'s with different paths',
                async () => {
            spyOn(process, 'cwd').and.returnValue('/blog');
            spyOn(fs, 'readFile').and.returnValue(
                Promise.resolve(`.foo { color: red; }`),
            );

            // Two links to the same file, but using different paths.
            const styles = await execFilter(aggregateStyles, `
                foo.css
                ../www/foo.css
            `);

            expect(fs.readFile).toHaveBeenCalledTimes(1);
            expect(fs.readFile).toHaveBeenCalledWith(
                '/blog/src/www/foo.css',
                { encoding: 'utf8' },
            );

            // Only one copy of `foo.css` should be present.
            expect(styles).toBe(`.foo { color: red; }`);
        });
    });
});