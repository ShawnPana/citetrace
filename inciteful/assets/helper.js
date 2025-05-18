// scripts/cleanSimilarity.js
const raw = require('../assets/similarity_scores.json');

// the exact file names you want:
const files = [
  'Broken Symmetries.pdf',
  'Dynamics and Generalization in Deep Networks.pdf',
  'Dynamics of generalization error.pdf',
  'Gradient Flows- In Metric Spaces and in the Space of Probability Measures.pdf',
  'Information_Content_of_Spontaneous_Symmetry_Breaks.pdf',
  'Information_Originates_in_Symmetry_Breaking.pdf',
  'Introduction to Optimal Transport.pdf',
  'More is Different.pdf',
  'Stochastic quantization and diffusion models.pdf',
  'The Information Bottleneck Method.pdf',
  'Thermodynamic Insights into Symmetry Breaking.pdf',
  'Thermodynamics as a theory of decision-making with information processing costs.pdf',
  'The Variational Formulation of the Fokker-Planck Equation.pdf'
];

function cleanKey(name) {
  // raw keys look like "mock/Category/filename.pdf"
  // find the raw key that endsWith our filename:
  return Object.keys(raw).find(k => k.endsWith(name));
}

const clean = {};
files.forEach(a => {
  const rawA = cleanKey(a);
  if (!rawA) return;
  clean[a] = {};
  files.forEach(b => {
    if (a === b) return;
    const rawB = cleanKey(b);
    const score =
      raw[rawA]?.[rawB] !== undefined
        ? raw[rawA][rawB]
        : raw[rawB]?.[rawA];
    if (score !== undefined) {
      clean[a][b] = score;
    }
  });
});

console.log(JSON.stringify(clean, null, 2));
