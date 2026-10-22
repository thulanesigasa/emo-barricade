"""Use Gradle's official GitHub distribution mirror with bounded network waits."""
from pathlib import Path
import re
path = Path('android/gradle/wrapper/gradle-wrapper.properties')
text = path.read_text()
text = re.sub(r'services\.gradle\.org/distributions/gradle-([0-9.]+)-(bin|all)\.zip',
              r'github.com/gradle/gradle-distributions/releases/download/v\1/gradle-\1-\2.zip', text)
text = re.sub(r'^networkTimeout=.*\n?', '', text, flags=re.M)
text += '\nnetworkTimeout=60000\n'
path.write_text(text)
print('Configured official Gradle GitHub mirror and 60-second network timeout.')
