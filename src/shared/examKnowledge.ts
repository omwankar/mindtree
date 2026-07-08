/**
 * Assessment format: 22 questions (20 MCQ Math/ML + 2 DSA coding).
 */

export const EXAM_CONTEXT = `
ASSESSMENT FORMAT (22 questions total):
• 20 MCQ — Mathematics + Machine Learning concepts
• 2 Coding — Data Structures & Algorithms

═══ MCQ — MATHEMATICS (solve step-by-step mentally, pick correct option) ═══
Linear algebra: matrices, eigenvalues, rank, dot products, determinants
Probability: Bayes, conditional probability, distributions (normal, binomial, Poisson)
Statistics: mean/median/mode, variance, std dev, z-scores, confidence intervals, hypothesis testing
Calculus: derivatives, integrals, gradients, partial derivatives, optimization
Combinatorics: permutations, combinations, counting principles
Logic & sets: Venn diagrams, set operations

═══ MCQ — MACHINE LEARNING ═══
Supervised: regression, classification, loss functions (MSE, cross-entropy), bias-variance tradeoff
Models: linear/logistic regression, decision trees, random forest, SVM, k-NN, naive Bayes
Ensemble: bagging, boosting (AdaBoost, XGBoost conceptually)
Unsupervised: k-means, hierarchical clustering, PCA, dimensionality reduction
Evaluation: accuracy, precision, recall, F1, ROC-AUC, confusion matrix, overfitting/underfitting
Regularization: L1/L2, dropout, early stopping
Optimization: gradient descent, SGD, learning rate, convex vs non-convex
NLP basics: TF-IDF, word embeddings concept, tokenization
Neural nets: activation functions (ReLU, sigmoid, softmax), backprop concept, layers

═══ CODING — DSA (2 problems) ═══
Patterns: arrays, strings, hash maps, two pointers, sliding window, binary search
Trees & graphs: BFS, DFS, BST operations, shortest path basics
Dynamic programming: 1D/2D DP, memoization, tabulation
Heaps & sorting: priority queue, merge sort, quicksort complexity
Complexity: state time/space in Big-O; prefer optimal acceptable solution
Default language: Python 3 unless problem specifies Java/C++/JavaScript
Match function/class signature shown on screen exactly
Handle edge cases: empty input, single element, negatives, overflow where relevant
`.trim()

export const EXAM_PROFILE_NAME = 'ML · Math · DSA Assessment (22 Q)'

export const EXAM_TOTAL_QUESTIONS = 22
export const EXAM_MCQ_COUNT = 20
export const EXAM_CODE_COUNT = 2
