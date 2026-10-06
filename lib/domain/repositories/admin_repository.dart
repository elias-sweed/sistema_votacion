abstract class AdminRepository {
  Future<int> count();
  Future<Map<String, dynamic>?> findByUsername(String username);
  Future<void> insert(Map<String, dynamic> data);
  Future<void> updatePassword(int id, Map<String, dynamic> data);
}



