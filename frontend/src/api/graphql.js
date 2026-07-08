import axios from "axios";

const graphqlClient = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL
    ? `${import.meta.env.VITE_BACKEND_URL}/graphql`
    : "http://localhost:8080/graphql",
  withCredentials: true,
});

/**
 * Execute a GraphQL query or mutation.
 * @param {string} query - The GraphQL query or mutation string.
 * @param {object} variables - Optional variables for the query.
 */
export async function graphqlRequest(query, variables = {}) {
  try {
    const response = await graphqlClient.post("", { query, variables });
    if (response.data.errors) {
      throw new Error(response.data.errors[0].message);
    }
    return response.data.data;
  } catch (error) {
    console.error("GraphQL Request failed:", error);
    throw error;
  }
}

// Sample Query: Fetch documents
export const GET_DOCUMENTS = `
  query GetDocuments($q: String, $all: Boolean, $parentId: String) {
    documents(q: $q, all: $all, parentId: $parentId) {
      id
      title
      content
      parentId
      createdAt
      updatedAt
      userId
    }
  }
`;

// Sample Mutation: Add a comment
export const ADD_COMMENT = `
  mutation AddComment($docId: ID!, $content: String!, $anchor: String, $parentId: String) {
    addComment(docId: $docId, content: $content, anchor: $anchor, parentId: $parentId) {
      id
      userId
      content
      createdAt
    }
  }
`;
