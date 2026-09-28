import title from './title.js';
import moonrise from './moonrise.js';
import greatwall from './greatwall.js';
import voyage1784 from './voyage1784.js';
import goldengate from './goldengate.js';
import pandas from './pandas.js';
import rosegarden from './rosegarden.js';
import finale from './finale.js';
import pinecrane from './pinecrane.js';
import plum from './plum.js';
import riverboat from './riverboat.js';
import bamboo from './bamboo.js';

const ALL = [title, moonrise, greatwall, voyage1784, goldengate, pandas, rosegarden, finale, pinecrane, plum, riverboat, bamboo];

export const SCENES = Object.fromEntries(ALL.map((s) => [s.id, s]));

// Default running order: the visit programme 《山海不为远》, then evergreen interludes.
export const VISIT = ['title', 'moonrise', 'greatwall', 'voyage1784', 'goldengate', 'pandas', 'rosegarden', 'finale'];
export const EVERGREEN = ['pinecrane', 'plum', 'riverboat', 'bamboo'];
export const PROGRAM = [...VISIT, ...EVERGREEN];
