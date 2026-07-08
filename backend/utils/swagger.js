import swaggerJSDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "CollabDocs API Spec",
      version: "1.0.0",
      description: "Enterprise Swagger API documentation for the CollabDocs real-time editor.",
    },
    servers: [
      {
        url: "http://localhost:5000",
        description: "Development server",
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
  apis: ["./routes/*.js", "./server.js"],
};

const swaggerSpec = swaggerJSDoc(options);

export { swaggerUi, swaggerSpec };
