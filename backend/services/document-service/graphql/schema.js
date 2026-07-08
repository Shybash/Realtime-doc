export const typeDefs = `#graphql
  type UserPermission {
    userId: String!
    role: String!
  }

  type Document {
    id: ID!
    title: String!
    content: String
    parentId: String
    coverImage: String
    icon: String
    userId: String!
    createdAt: String
    updatedAt: String
    allowedUsers: [String!]!
    permissions: [UserPermission!]!
  }

  type Comment {
    id: ID!
    userId: String!
    content: String!
    anchor: String
    parentId: String
    createdAt: String
    updatedAt: String
  }

  type Query {
    documents(q: String, all: Boolean, parentId: String): [Document!]!
    document(id: ID!): Document
    comments(docId: ID!): [Comment!]!
  }

  type Mutation {
    createDocument(
      title: String!
      content: String
      parentId: String
      coverImage: String
      icon: String
    ): Document!

    updateDocumentTitle(id: ID!, title: String!): Document!

    addComment(
      docId: ID!
      content: String!
      anchor: String
      parentId: String
    ): Comment!

    deleteComment(docId: ID!, commentId: ID!): Boolean!
  }
`;
