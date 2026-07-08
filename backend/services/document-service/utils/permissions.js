function hasDocumentRole(doc, userId, allowedRoles) {
  if (!doc.permissions) return false;
  return doc.permissions.some(
    (perm) => perm.userId === userId && allowedRoles.includes(perm.role)
  );
}

export { hasDocumentRole };
