// Seeded question bank for the sample DSA material. SERVER-ONLY: contains answer keys.
// Every question cites a section of sample-materials/dsa-notes.txt; tests verify each citation
// resolves to a real chunk and that the correct answer is supported by that chunk's text.
import type { Difficulty, QuestionType } from "@/types/domain";

export interface BankQuestion {
  id: string;
  topicCode: string; // syllabus sub-topic code, e.g. "4.2"
  sectionCode: string; // notes section the question is grounded in
  type: QuestionType;
  difficulty: Difficulty;
  prompt: string;
  options?: string[];
  correctOption?: number;
  expectedAnswer?: string;
  keyPoints?: string[]; // "|" separates alternative phrasings of one key point
  explanation: string;
  rationales?: Record<number, string>; // misconception shown when that wrong option is chosen
}

const mcq = (
  id: string,
  code: string,
  difficulty: Difficulty,
  prompt: string,
  options: string[],
  correctOption: number,
  explanation: string,
  rationales: Record<number, string> = {}
): BankQuestion => ({ id, topicCode: code, sectionCode: code, type: "mcq", difficulty, prompt, options, correctOption, explanation, rationales });

const short = (id: string, code: string, difficulty: Difficulty, prompt: string, expectedAnswer: string, keyPoints: string[], explanation: string): BankQuestion => ({
  id,
  topicCode: code,
  sectionCode: code,
  type: "short",
  difficulty,
  prompt,
  expectedAnswer,
  keyPoints,
  explanation,
});

export const QUESTION_BANK: BankQuestion[] = [
  // Unit 1 — Arrays
  mcq("q-arr-1", "1.1", "easy", "Why can an array element be read by its index in constant time?", [
    "Its address is computed from the base address plus the index multiplied by the element size",
    "The array is always kept sorted",
    "Elements are found by following references from the first element",
    "The processor keeps every element in a register",
  ], 0, "Arrays are contiguous and every element has the same size, so address = base + i × size. This address arithmetic makes index access O(1).", {
    1: "Confusing constant-time index access with searching a sorted array",
    2: "Mixing up arrays with linked lists (following references)",
    3: "Believing O(1) access comes from hardware rather than address arithmetic",
  }),
  mcq("q-arr-2", "1.1", "medium", "In a zero-indexed array of length n, at which index is the last element stored?", ["n - 1", "n", "n + 1", "1"], 0,
    "With zero-based indexing the first element is at index 0, so the last of n elements is at index n - 1. Index n is out of bounds.", {
      1: "Off-by-one error: index n is out of bounds",
      2: "Off-by-one error: index n + 1 is out of bounds",
      3: "Confusing the last index with the first index",
    }),
  mcq("q-arr-3", "1.2", "easy", "What is the worst-case time to search an unsorted array for a value?", ["O(n), because a linear scan may inspect every element", "O(1)", "O(log n)", "O(n^2)"], 0,
    "Without ordering, a linear scan may have to inspect every element, so searching takes O(n). Binary search's O(log n) needs a sorted array.", {
      1: "Confusing search with index access",
      2: "Applying binary search to an array that is not sorted",
      3: "Overestimating the cost of a single linear scan",
    }),
  mcq("q-arr-4", "1.2", "medium", "Why does inserting an element at the front of an array cost O(n)?", [
    "Every element after the position must shift by one place to keep storage contiguous",
    "The array must be sorted again after every insertion",
    "The whole array is always copied into a block of double capacity",
    "Binary search is needed to locate the front",
  ], 0, "Insertion at the front or middle shifts every later element by one place so the storage stays contiguous — that shifting is O(n).", {
    1: "Assuming arrays must stay sorted",
    2: "Confusing element shifting with dynamic-array resizing",
    3: "Confusing insertion with searching",
  }),
  mcq("q-arr-5", "1.3", "hard", "Using two pointers on a sorted array to find a pair with a given sum, what should you do when the current sum is too small?", [
    "Move the left pointer right",
    "Move the right pointer left",
    "Move both pointers inward",
    "Restart with nested loops over every pair",
  ], 0, "In a sorted array, moving the left pointer right increases the sum. If the sum is too small, move the left pointer right; if too large, move the right pointer left.", {
    1: "Moving the right pointer left makes a too-small sum even smaller",
    2: "Moving both pointers skips candidate pairs",
    3: "Falling back to the O(n^2) brute force the technique avoids",
  }),
  short("q-arr-6", "1.3", "medium", "Explain how a sliding window computes the maximum sum of k consecutive elements in O(n) time.",
    "Keep a running sum of the current window. When the window slides one position, add the entering element and subtract the leaving element instead of recomputing the whole window.",
    ["add entering element|add new element|add next element|add incoming element", "subtract leaving element|subtract old element|subtract outgoing element|remove leaving element|subtract first element", "running sum|running total|keep sum|maintain sum"],
    "A sliding window updates a running value: add the element entering the window and subtract the one leaving, so each step is O(1) and the whole scan is O(n)."),

  // Unit 2 — Linked lists
  mcq("q-ll-1", "2.1", "easy", "How is the k-th node of a singly linked list reached?", [
    "Start at the head and follow k next references",
    "Compute its address from the base address and k",
    "Jump directly to it using its index",
    "Follow prev references back from the last node",
  ], 0, "Linked-list nodes are not contiguous, so there is no address arithmetic: you start at the head and follow next references, which is O(n).", {
    1: "Treating a linked list like an array (address arithmetic)",
    2: "Believing linked lists support direct index access",
    3: "Confusing singly linked lists with doubly linked lists",
  }),
  mcq("q-ll-2", "2.1", "medium", "What does the next reference of the last node in a singly linked list contain?", ["null", "A reference back to the head node", "A reference to itself", "The number of nodes in the list"], 0,
    "In a singly linked list the last node's next reference is null, which is how traversal knows it has reached the end.", {
      1: "Confusing singly linked lists with circular linked lists",
      2: "Misunderstanding how the end of a list is marked",
      3: "Confusing node references with list metadata",
    }),
  mcq("q-ll-3", "2.2", "easy", "What is the time complexity of inserting a new node at the head of a singly linked list?", ["O(1)", "O(n)", "O(log n)", "O(n^2)"], 0,
    "Set the new node's next to the current head and move the head pointer to the new node — two reference updates, no shifting, so O(1).", {
      1: "Assuming linked-list insertion shifts elements like an array",
      2: "Confusing insertion with binary search",
      3: "Overestimating the cost of pointer updates",
    }),
  mcq("q-ll-4", "2.2", "hard", "To delete a node from a singly linked list, which node do you need a reference to?", [
    "The node before it, so that its next can skip over the removed node",
    "Only the tail node",
    "The node after it",
    "No node: deletion uses index arithmetic",
  ], 0, "Deletion relinks the predecessor: its next must skip the removed node, so you need a reference to the node before it.", {
    1: "Thinking the tail pointer is enough to unlink an arbitrary node",
    2: "Not realising the predecessor's next reference must change",
    3: "Treating a linked list like an array",
  }),
  mcq("q-ll-5", "2.3", "medium", "What is an advantage of a doubly linked list over a singly linked list?", [
    "It can delete a node in O(1) time given a reference to that node, because prev gives its predecessor",
    "It uses less memory per node",
    "It allows O(1) access by index",
    "Insertion needs no pointer updates",
  ], 0, "The prev reference makes the predecessor available, so deleting a node you hold a reference to is O(1). The cost is extra memory and more pointer updates.", {
    1: "Overlooking the extra memory cost of the prev reference",
    2: "Believing linked lists support index arithmetic",
    3: "Overlooking that doubly linked lists need more pointer updates, not fewer",
  }),
  short("q-ll-6", "2.3", "medium", "What must a traversal of a circular linked list check, and why?",
    "It must stop when it returns to its starting node, because the last node's next points back to the first node instead of null; otherwise it loops forever.",
    ["back to starting node|returns to start|reaches starting node|back to the start|back to head|reach head again|stop at starting node", "last node next points first node|points back to first|points back to head|no null|instead of null", "loops forever|infinite loop|loop forever|never ends|never stops"],
    "A circular list has no null terminator: the last node's next points to the first, so traversal must stop when it returns to the starting node or it will loop forever."),

  // Unit 3 — Stacks and queues
  mcq("q-sq-1", "3.1", "easy", "Which element does pop remove from a stack?", ["The element added most recently", "The element added first", "The smallest element", "A randomly chosen element"], 0,
    "A stack is last-in, first-out (LIFO): pop removes the element that was added most recently.", {
      1: "Confusing LIFO stacks with FIFO queues",
      2: "Confusing a stack with a priority queue",
      3: "Misunderstanding stack ordering",
    }),
  mcq("q-sq-2", "3.1", "medium", "What happens when pop is called on an empty stack?", ["An underflow error", "An overflow error", "It returns the bottom element", "The stack doubles its capacity"], 0,
    "Popping an empty stack is an underflow error; overflow is pushing onto a full fixed-capacity stack.", {
      1: "Mixing up stack underflow and overflow",
      2: "Misunderstanding what an empty stack contains",
      3: "Confusing pop with dynamic-array resizing",
    }),
  mcq("q-sq-3", "3.2", "easy", "In which order do elements leave a queue?", ["The same order in which they arrived (first-in, first-out)", "The reverse order of arrival (last-in, first-out)", "Sorted order", "Random order"], 0,
    "A queue is FIFO: elements are dequeued from the front in the same order they were enqueued at the rear.", {
      1: "Confusing FIFO queues with LIFO stacks",
      2: "Confusing a queue with a priority queue",
      3: "Misunderstanding queue ordering",
    }),
  mcq("q-sq-4", "3.2", "hard", "Why is implementing a queue on a plain array, removing from index 0, inefficient?", [
    "Every dequeue shifts the remaining elements, which costs O(n)",
    "An array can only store one element at a time",
    "Every enqueue must sort the array",
    "Index 0 cannot be accessed in constant time",
  ], 0, "Removing from index 0 shifts all remaining elements, so each dequeue is O(n). A circular buffer or a linked list with head and tail pointers gives O(1).", {
    1: "Misunderstanding array capacity",
    2: "Assuming queues must be kept sorted",
    3: "Thinking index access itself is slow, rather than the shifting",
  }),
  mcq("q-sq-5", "3.3", "medium", "When checking bracket matching with a stack, what is done when a closing bracket appears?", [
    "Pop the stack and check that the popped bracket is the matching opener",
    "Push the closing bracket onto the stack",
    "Enqueue the closing bracket in a queue",
    "Ignore it until the end of the scan",
  ], 0, "Opening brackets are pushed; on a closing bracket you pop and check the popped bracket is its matching opener. The expression is balanced only if all match and the stack ends empty.", {
    1: "Pushing closing brackets instead of matching them",
    2: "Using a queue where LIFO order is required",
    3: "Deferring the check loses the nesting order",
  }),
  short("q-sq-6", "3.3", "medium", "Explain why breadth-first search uses a queue.",
    "BFS repeatedly dequeues a vertex and enqueues its unvisited neighbours. Because a queue is first-in first-out, vertices are processed level by level in order of their distance from the start.",
    ["first in first out|fifo", "level by level|order of distance|order of their distance|layer by layer|distance from start", "enqueue unvisited neighbour|enqueue neighbour|add unvisited neighbour|add neighbour"],
    "BFS dequeues a vertex and enqueues its unvisited neighbours; the queue's FIFO order means vertices are processed level by level, by distance from the start."),

  // Unit 4 — Trees
  mcq("q-tr-1", "4.1", "easy", "What is a leaf in a tree?", ["A node with no children", "The node without a parent", "Any node at depth 1", "A node with exactly two children"], 0,
    "A leaf is a node with no children. The single node without a parent is the root.", {
      1: "Confusing leaf nodes with the root",
      2: "Confusing leaves with nodes at a particular depth",
      3: "Confusing leaves with full internal nodes",
    }),
  mcq("q-tr-2", "4.1", "medium", "How many edges does a tree with n nodes have?", ["n - 1", "n", "n + 1", "2n"], 0,
    "Every node except the root has exactly one edge to its parent, so a tree with n nodes has n - 1 edges.", {
      1: "Forgetting that the root has no parent edge",
      2: "Overcounting edges",
      3: "Counting each edge twice",
    }),
  mcq("q-tr-3", "4.2", "medium", "In a binary search tree, where are all keys smaller than a node's key stored?", ["In its left subtree", "In its right subtree", "Only in its parent", "Only in the leaves"], 0,
    "The BST ordering property: all keys in the left subtree are smaller than the node's key and all keys in the right subtree are larger.", {
      1: "Reversing the BST ordering property",
      2: "Misunderstanding the BST ordering property",
      3: "Misunderstanding the BST ordering property",
    }),
  mcq("q-tr-4", "4.2", "hard", "What happens if keys are inserted into an ordinary binary search tree in already sorted order?", [
    "The tree degenerates into a shape like a linked list and operations take O(n) time",
    "The tree stays balanced automatically",
    "Insertion fails",
    "Search becomes O(1)",
  ], 0, "Search and insertion cost is proportional to height. Sorted insertions produce a degenerate, list-shaped tree with O(n) height; self-balancing trees such as AVL trees avoid this.", {
    1: "Assuming every BST is self-balancing",
    2: "Misunderstanding BST insertion",
    3: "Confusing BST search with hashing or array indexing",
  }),
  mcq("q-tr-5", "4.3", "easy", "Which traversal of a binary search tree outputs the keys in sorted ascending order?", ["Inorder", "Preorder", "Postorder", "Level order"], 0,
    "Inorder visits the left subtree, then the node, then the right subtree — for a BST that is ascending key order.", {
      1: "Mixing up inorder and preorder traversal",
      2: "Mixing up inorder and postorder traversal",
      3: "Confusing level-order with sorted order",
    }),
  short("q-tr-6", "4.3", "hard", "How does level-order traversal differ from preorder, inorder and postorder traversal?",
    "Level-order traversal visits nodes level by level from the root downwards and is implemented with a queue, whereas preorder, inorder and postorder are depth-first traversals usually written recursively.",
    ["level by level|level after level|one level at a time", "queue", "depth first|recursive|recursion|recursively"],
    "Level order goes level by level using a queue; preorder, inorder and postorder are depth-first and naturally recursive."),

  // Unit 5 — Graphs
  mcq("q-gr-1", "5.1", "easy", "How much memory does an adjacency matrix use for a graph with V vertices?", ["O(V^2)", "O(V + E)", "O(E)", "O(V)"], 0,
    "An adjacency matrix is a V by V table, so it always uses O(V^2) memory, even when there are few edges.", {
      1: "Confusing adjacency matrix and adjacency list memory costs",
      2: "Ignoring the cells for edges that do not exist",
      3: "Underestimating the size of a V by V table",
    }),
  mcq("q-gr-2", "5.1", "medium", "Which representation is preferred for a sparse graph, where E is much smaller than V^2?", ["Adjacency list", "Adjacency matrix", "A sorted array of vertices", "A single linked list of all vertices and edges"], 0,
    "Adjacency lists use O(V + E) memory, so they are preferred for sparse graphs; a matrix wastes O(V^2) memory.", {
      1: "Not recognising that adjacency matrices waste memory on sparse graphs",
      2: "A vertex array alone cannot record edges",
      3: "Misunderstanding graph representations",
    }),
  mcq("q-gr-3", "5.2", "medium", "When should breadth-first search mark a vertex as visited?", ["When it is enqueued", "When it is dequeued", "After the whole search finishes", "Never; BFS does not track visited vertices"], 0,
    "Mark vertices visited when they are enqueued; otherwise the same vertex can be added to the queue several times.", {
      1: "Marking on dequeue lets the same vertex be enqueued several times",
      2: "Not tracking visited vertices during the search",
      3: "Not tracking visited vertices during the search",
    }),
  mcq("q-gr-4", "5.2", "hard", "For which graphs does breadth-first search find shortest paths?", [
    "Unweighted graphs, with path length measured in number of edges",
    "Graphs with arbitrary positive edge weights",
    "Only trees",
    "Any weighted graph, if it is run twice",
  ], 0, "BFS discovers vertices in order of edge count from the source, so it finds shortest paths in unweighted graphs. Weighted edges require an algorithm such as Dijkstra's.", {
    1: "Using BFS where weighted edges require Dijkstra's algorithm",
    2: "Underestimating where BFS applies",
    3: "Using BFS where weighted edges require Dijkstra's algorithm",
  }),
  mcq("q-gr-5", "5.3", "medium", "During depth-first search of a directed graph, what proves the graph contains a cycle?", [
    "An edge to a vertex still on the current recursion path (a back edge)",
    "Reaching a vertex with no outgoing edges",
    "Finishing before every vertex is visited",
    "Reaching a vertex with more than two neighbours",
  ], 0, "A back edge — an edge to a vertex that is still on the current recursion path — proves a directed cycle.", {
    1: "Confusing a dead end with a cycle",
    2: "Confusing disconnected components with cycles",
    3: "Confusing vertex degree with cycles",
  }),
  short("q-gr-6", "5.3", "hard", "Describe how depth-first search explores a graph and what it uses to keep track of its path.",
    "DFS follows one path as deeply as possible before backtracking to try other branches. It keeps track of the path with the call stack when written recursively, or with an explicit stack when written iteratively.",
    ["deeply as possible|deep as possible|go deep|deepest", "backtrack|backtracking|backtracks", "stack|recursion|recursive"],
    "DFS goes as deep as possible along one path, then backtracks; the path is kept on the call stack (recursive) or an explicit stack (iterative)."),

  // Unit 6 — Recursion
  mcq("q-rc-1", "6.1", "easy", "What is the purpose of the base case in a recursive function?", [
    "It returns an answer directly without recursing, so the recursion terminates",
    "It makes the function run faster",
    "It reduces the problem and calls the function again",
    "It stores the results of subproblems",
  ], 0, "The base case returns an answer directly without recursing. Without a reachable base case the function keeps calling itself until it runs out of stack space.", {
    1: "Thinking the base case is an optimisation",
    2: "Confusing the base case with the recursive case",
    3: "Confusing the base case with memoization",
  }),
  mcq("q-rc-2", "6.1", "medium", "For factorial(n) written recursively, which is the base case?", ["Return 1 when n is 0", "Return n multiplied by factorial(n - 1)", "Return 0 when n is 1", "Return factorial(n + 1)"], 0,
    "factorial(n) returns 1 when n is 0 (base case); otherwise n × factorial(n - 1) (recursive case).", {
      1: "Confusing the recursive case with the base case",
      2: "Wrong base value for factorial",
      3: "Recursing away from the base case",
    }),
  mcq("q-rc-3", "6.2", "easy", "What does each function call push onto the call stack?", [
    "A stack frame holding the call's parameters, local variables and return address",
    "Only the function's return value",
    "A copy of the whole program",
    "Nothing; only loops use the stack",
  ], 0, "Every call pushes a stack frame with its parameters, local variables and return address; the frame is popped when the call finishes.", {
    1: "Misunderstanding what a stack frame contains",
    2: "Misunderstanding how function calls use memory",
    3: "Not knowing that function calls use the call stack",
  }),
  mcq("q-rc-4", "6.2", "hard", "How much stack space does a recursive function with recursion depth d use?", ["O(d)", "O(1)", "O(log d)", "O(2^d)"], 0,
    "Each pending call keeps a frame on the call stack, so recursion depth d uses O(d) stack space even with no other allocation.", {
      1: "Forgetting that every pending call keeps a frame on the stack",
      2: "Underestimating stack usage of recursion",
      3: "Confusing stack depth with the total number of calls",
    }),
  mcq("q-rc-5", "6.3", "medium", "How does memoization speed up the naive recursive Fibonacci function?", [
    "It stores the result of each subproblem and returns the stored value on later calls",
    "It removes the base case",
    "It turns the function into tail recursion",
    "It runs the recursive calls in parallel",
  ], 0, "Memoization stores each subproblem's result the first time and reuses it, reducing Fibonacci from exponential time to O(n).", {
    1: "Confusing memoization with removing termination",
    2: "Confusing memoization with tail recursion",
    3: "Confusing memoization with parallelism",
  }),
  short("q-rc-6", "6.3", "medium", "Give two reasons why an iterative solution may be preferred over a recursive one.",
    "Iteration avoids the overhead of function calls and avoids the risk of stack overflow when recursion is very deep.",
    ["overhead function call|function call overhead|fewer function calls|no function calls|call overhead", "stack overflow|stack space|run out of stack"],
    "Loops avoid function-call overhead and the risk of stack overflow from deep recursion."),
];
