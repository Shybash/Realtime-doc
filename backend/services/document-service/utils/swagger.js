import swaggerJSDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "CollabDocs Document Service API Spec",
      version: "1.0.0",
      description: "Interactive Swagger API documentation for the CollabDocs Document Microservice.",
    },
    servers: [
      {
        url: "http://localhost:5000",
        description: "Development Document Server",
      },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "token",
          description: "Firebase JWT Session Token in httpOnly Cookie"
        }
      }
    }
  },
  apis: ["./routes/*.js"],
};

const swaggerSpec = swaggerJSDoc(options);

export { swaggerUi, swaggerSpec };
